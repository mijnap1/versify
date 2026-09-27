import { NextResponse } from "next/server";
import { starterTracks, type Track } from "@/lib/tracks";
import { hasTimedLyrics } from "@/lib/starter";
import { findAudioVideo } from "@/lib/video-match";
import { lyricLanguage } from "@/lib/lyrics";
import { findLyrics } from "@/lib/lyric-source";

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
    const responses = await Promise.all(shuffled(terms).slice(0, 4).map((term) => {
      const query = new URLSearchParams({ term, country: shuffled(countries)[0], entity: "song", limit: "50" });
      return fetch(`https://itunes.apple.com/search?${query}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) });
    }));
    const seen = new Set<string>();
    const data = await Promise.all(responses.filter((response) => response.ok).map((response) => response.json()));
    candidates = data.flatMap((result) => result.results ?? [])
      .filter((item: { kind: string; trackId: number; trackTimeMillis: number }) => {
        if (item.kind !== "song" || seen.has(String(item.trackId)) || item.trackTimeMillis < 60000 || item.trackTimeMillis > 600000) return false;
        seen.add(String(item.trackId)); return true;
      })
      .map((item: { trackId: number; trackName: string; artistName: string; collectionName: string; trackTimeMillis: number; artworkUrl100?: string }) => ({
          id: String(item.trackId), title: item.trackName, artist: item.artistName, album: item.collectionName,
          duration: item.trackTimeMillis / 1000,
          artwork: item.artworkUrl100 ? `/api/artwork?url=${encodeURIComponent(item.artworkUrl100.replace("100x100bb", "600x600bb"))}` : "",
      }));
  } catch { /* Try the verified catalog fallbacks when search is unavailable. */ }

  for (const track of [...shuffled(candidates).slice(0, 24), ...shuffled(starterTracks)]) {
    try {
      const lyrics = await findLyrics(track, AbortSignal.timeout(5000));
      if (!hasTimedLyrics(lyrics, track.duration)) continue;
      const videoId = await findAudioVideo({ ...track, language: lyricLanguage(lyrics) });
      if (!videoId) continue;
      return NextResponse.json({ track: { ...track, videoId }, lyrics: { syncedLyrics: lyrics.syncedLyrics, plainLyrics: lyrics.plainLyrics ?? null, instrumental: false } }, { headers: { "Cache-Control": "no-store" } });
    } catch { /* Skip unavailable or untimed recordings. */ }
  }
  return NextResponse.json({ error: "Couldn't find a song with timed lyrics right now. Please search for a song." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
