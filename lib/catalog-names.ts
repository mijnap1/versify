import { normalized } from "./song-match.ts";

export type SongNames = { title: string; artist: string; album: string };

// Apple's US storefront translates Korean, Japanese, and Chinese names ("If there was practice in love"),
// while LRCLIB and YouTube Music usually file the song natively ("사랑에 연습이 있었다면").
const storefronts = ["kr", "jp", "tw"];

export async function localizedNames(track: SongNames & { id?: string }, signal?: AbortSignal): Promise<SongNames[]> {
  if (!track.id || !/^\d{1,20}$/.test(track.id)) return [];
  const results = await Promise.allSettled(storefronts.map(async (country) => {
    const response = await fetch(`https://itunes.apple.com/lookup?${new URLSearchParams({ id: track.id!, country })}`, {
      next: { revalidate: 86400 }, signal: AbortSignal.any([AbortSignal.timeout(4000), ...(signal ? [signal] : [])]),
    });
    if (!response.ok) return null;
    const song = (await response.json()).results?.[0];
    return typeof song?.trackName === "string" && typeof song.artistName === "string"
      ? { title: song.trackName, artist: song.artistName, album: typeof song.collectionName === "string" ? song.collectionName : "" } : null;
  }));
  const key = (names: SongNames) => `${normalized(names.title)}:${normalized(names.artist)}`;
  const seen = new Set([key(track)]);
  return results.flatMap((result) => {
    if (result.status !== "fulfilled" || !result.value || seen.has(key(result.value))) return [];
    seen.add(key(result.value));
    return [result.value];
  });
}
