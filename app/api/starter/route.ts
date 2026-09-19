import { NextResponse } from "next/server";
import { starterTracks, type Track } from "@/lib/tracks";
import { hasTimedLyrics } from "@/lib/starter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Different catalog searches provide a broad, changing pool, not a fixed playlist.
const terms = ["love", "night", "dream", "home", "rain", "dance", "heart", "sky", "summer", "light", "world", "time", "stay", "blue", "music", "you", "사랑", "봄", "夜", "君", "amor", "vida"];
const countries = ["us", "gb", "ca", "kr", "jp", "mx"];
function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function GET() {
  let candidates: Track[] = [];
  try {
    const query = new URLSearchParams({ term: shuffled(terms)[0], country: shuffled(countries)[0], entity: "song", limit: "50" });
    const response = await fetch(`https://itunes.apple.com/search?${query}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) });
    if (response.ok) {
      const data = await response.json();
      candidates = (data.results ?? []).filter((item: { kind: string; trackTimeMillis: number }) => item.kind === "song" && item.trackTimeMillis > 60000 && item.trackTimeMillis < 600000)
        .map((item: { trackId: number; trackName: string; artistName: string; collectionName: string; trackTimeMillis: number; artworkUrl100?: string }) => ({
          id: String(item.trackId), title: item.trackName, artist: item.artistName, album: item.collectionName,
          duration: item.trackTimeMillis / 1000,
          artwork: item.artworkUrl100 ? `/api/artwork?url=${encodeURIComponent(item.artworkUrl100.replace("100x100bb", "600x600bb"))}` : "",
        }));
    }
  } catch { /* Try the verified catalog fallbacks when search is unavailable. */ }

  for (const track of [...shuffled(candidates).slice(0, 6), ...shuffled(starterTracks)]) {
    try {
      const query = new URLSearchParams({ track_name: track.title, artist_name: track.artist, album_name: track.album, duration: String(Math.round(track.duration)) });
      const response = await fetch(`https://lrclib.net/api/get?${query}`, { headers: { "User-Agent": "Versify/1.0" }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(2500) });
      if (!response.ok) continue;
      const lyrics = await response.json();
      if (!hasTimedLyrics(lyrics, track.duration)) continue;
      return NextResponse.json({ track, lyrics: { syncedLyrics: lyrics.syncedLyrics, plainLyrics: lyrics.plainLyrics ?? null, instrumental: false } }, { headers: { "Cache-Control": "no-store" } });
    } catch { /* Skip unavailable or untimed recordings. */ }
  }
  return NextResponse.json({ error: "Couldn't find a song with timed lyrics right now. Please search for a song." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
