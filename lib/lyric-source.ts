import { hasTimedLyrics } from "./starter.ts";
import { lyricLanguage, parseLrc } from "./lyrics.ts";
import { baseTitle, normalized, primaryArtist, sameArtist, titleMatch } from "./song-match.ts";
import { localizedNames } from "./catalog-names.ts";

type Lyrics = { syncedLyrics: string | null; plainLyrics: string | null; instrumental: boolean };
type Entry = Lyrics & { trackName: string; artistName: string; albumName?: string; duration: number };
type Song = { id?: string; title: string; artist: string; album: string; duration: number };

// Synced timing only holds for the same edit; plain text survives small length differences.
const syncedTolerance = 3;
const plainTolerance = 10;
const retryable = new Set([429, 500, 502, 503, 504]);

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}

// LRCLIB sheds load with 503s; a short backoff recovers most of them.
async function lrclib(path: string, params: URLSearchParams, signal?: AbortSignal, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`https://lrclib.net/api/${path}?${params}`, {
        headers: { "User-Agent": "Versify/1.0" }, next: { revalidate: 86400 },
        signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]),
      });
      if (!retryable.has(response.status) || attempt >= retries) return response;
    } catch (error) {
      if (signal?.aborted || attempt >= retries) throw error;
    }
    await wait(400 * 2 ** attempt, signal);
  }
}

export function rankLyricEntries(entries: Entry[], track: Song, language?: string | null): Entry[] {
  return entries.flatMap((entry) => {
    if (typeof entry?.trackName !== "string" || typeof entry.artistName !== "string") return [];
    const difference = track.duration > 0 ? Math.abs(entry.duration - track.duration) : 0;
    const timed = hasTimedLyrics(entry, track.duration) && difference <= syncedTolerance;
    if (difference > plainTolerance || (!timed && !entry.plainLyrics && !entry.instrumental)) return [];
    const title = titleMatch(track.title, entry.trackName);
    if (!title) return [];
    // Some entries put every artist in the track name ("A, B - Song").
    const artist = sameArtist(track.artist, entry.artistName) || sameArtist(track.artist, entry.trackName);
    // Native-script artist names ("아이유" for "IU") only pass on an exact title and length.
    if (!artist && (title !== "exact" || difference > 1)) return [];
    if (language && lyricLanguage(entry) && lyricLanguage(entry) !== language) return [];
    const album = entry.albumName && normalized(entry.albumName) === normalized(track.album) ? 5 : 0;
    return [{ entry, score: (timed ? 100 : 0) + (title === "exact" ? 20 : 0) + (artist ? 20 : 0) + album - difference * 5 }];
  }).sort((a, b) => b.score - a.score).map(({ entry }) => entry);
}

export async function findLyrics(track: Song, signal?: AbortSignal): Promise<Lyrics> {
  const usable = (entry: Entry): Lyrics => ({
    syncedLyrics: hasTimedLyrics(entry, track.duration) && Math.abs(entry.duration - track.duration) <= syncedTolerance ? entry.syncedLyrics : null,
    plainLyrics: entry.plainLyrics || (entry.syncedLyrics ? parseLrc(entry.syncedLyrics).map((line) => line.text).join("\n") : null),
    instrumental: entry.instrumental,
  });
  let attempts = 0;
  let failures = 0;
  const exactParams = new URLSearchParams({ track_name: track.title, artist_name: track.artist,
    album_name: track.album, duration: String(Math.round(track.duration)) });
  async function exactMatch(path: string, retries?: number, timeout?: number): Promise<Entry | null> {
    attempts++;
    try {
      const limit = timeout ? AbortSignal.any([AbortSignal.timeout(timeout), ...(signal ? [signal] : [])]) : signal;
      const response = await lrclib(path, exactParams, limit, retries);
      if (response.ok) return await response.json();
      if (response.status !== 404) failures++;
    } catch (error) {
      if (signal?.aborted) throw error;
      failures++;
    }
    return null;
  }
  // "get-cached" answers from LRCLIB's own database. Plain "get" also asks outside providers for
  // unknown songs and is what LRCLIB sheds first under load, so it is only the last resort.
  const fallback = await exactMatch("get-cached");
  if (fallback && (hasTimedLyrics(fallback, track.duration) || fallback.instrumental)) return usable(fallback);

  const language = fallback && lyricLanguage({ plainLyrics: fallback.plainLyrics });
  // Field search is precise; free-text searches find entries filed under a different
  // artist credit or name order ("Lim Jae Hyun" for "Jaehyun Lim").
  const searches = (names: Song) => {
    const title = baseTitle(names.title);
    const artist = primaryArtist(names.artist);
    return [new URLSearchParams({ track_name: title, artist_name: artist }), new URLSearchParams({ q: `${title} ${artist}` }), new URLSearchParams({ q: title })];
  };
  const seen = new Set<string>();
  let best: Entry | undefined;
  async function search(names: Song) {
    for (const params of searches(names)) {
      if (best && usable(best).syncedLyrics) return;
      attempts++;
      try {
        const response = await lrclib("search", params, signal);
        if (!response.ok) throw new Error("Lyrics service unavailable");
        const entries: Entry[] = (await response.json()).filter((entry: Entry & { id?: number }) => {
          const key = String(entry.id ?? `${entry.trackName}:${entry.artistName}:${entry.duration}`);
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
        const [top] = rankLyricEntries([...(best ? [best] : []), ...entries], names, language);
        best = top ?? best;
      } catch (error) {
        if (signal?.aborted) throw error;
        failures++;
      }
    }
  }
  await search(track);
  // Native names keep the catalog's duration and only replace what LRCLIB matches on.
  if (!best || !usable(best).syncedLyrics) {
    for (const names of await localizedNames(track, signal).catch(() => [])) await search({ ...names, duration: track.duration });
  }
  if (best && usable(best).syncedLyrics) return usable(best);
  const fetched = await exactMatch("get", 0, 5000);
  if (fetched && (hasTimedLyrics(fetched, track.duration) || fetched.instrumental)) return usable(fetched);
  const plain = fallback ?? fetched ?? best;
  if (plain) return usable(plain);
  if (failures === attempts) throw new Error("Lyrics service unavailable");
  return { syncedLyrics: null, plainLyrics: null, instrumental: false };
}
