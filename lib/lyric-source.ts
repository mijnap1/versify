import { hasTimedLyrics } from "./starter.ts";
import { lyricLanguage, parseLrc } from "./lyrics.ts";

type Lyrics = { syncedLyrics: string | null; plainLyrics: string | null; instrumental: boolean };
type Entry = Lyrics & { trackName: string; artistName: string; duration: number };

export async function findLyrics(track: { title: string; artist: string; album: string; duration: number }, signal?: AbortSignal): Promise<Lyrics> {
  const request = (path: string, params: URLSearchParams) => fetch(`https://lrclib.net/api/${path}?${params}`, {
    headers: { "User-Agent": "Versify/1.0" }, next: { revalidate: 86400 },
    signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]),
  });
  const usable = (entry: Entry): Lyrics => ({
    syncedLyrics: hasTimedLyrics(entry, track.duration) ? entry.syncedLyrics : null,
    plainLyrics: entry.plainLyrics || (entry.syncedLyrics ? parseLrc(entry.syncedLyrics).map((line) => line.text).join("\n") : null),
    instrumental: entry.instrumental,
  });
  const exact = await request("get", new URLSearchParams({ track_name: track.title, artist_name: track.artist,
    album_name: track.album, duration: String(Math.round(track.duration)) }));
  const fallback: Entry | null = exact.ok ? await exact.json() : null;
  if (fallback && (hasTimedLyrics(fallback, track.duration) || fallback.instrumental)) return usable(fallback);
  if (!exact.ok && exact.status !== 404) throw new Error("Lyrics service unavailable");

  try {
    const response = await request("search", new URLSearchParams({ track_name: track.title, artist_name: track.artist }));
    if (!response.ok) throw new Error("Lyrics service unavailable");
    const entries: Entry[] = await response.json();
    const language = fallback && lyricLanguage({ plainLyrics: fallback.plainLyrics });
    const matches = entries.filter((entry) => entry.trackName.toLowerCase() === track.title.toLowerCase()
      && entry.artistName.toLowerCase() === track.artist.toLowerCase() && Math.abs(entry.duration - track.duration) < 5
      && (!language || !lyricLanguage(entry) || lyricLanguage(entry) === language));
    matches.sort((a, b) => Math.abs(a.duration - track.duration) - Math.abs(b.duration - track.duration));
    const match = matches.find((entry) => hasTimedLyrics(entry, track.duration)) ?? fallback ?? matches.find((entry) => entry.plainLyrics) ?? matches[0];
    return match ? usable(match) : { syncedLyrics: null, plainLyrics: null, instrumental: false };
  } catch (error) {
    if (signal?.aborted || !fallback) throw error;
    return usable(fallback);
  }
}
