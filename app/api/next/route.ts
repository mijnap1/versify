import { NextRequest, NextResponse } from "next/server";
import { hasTimedLyrics } from "@/lib/starter";
import { starterTracks, type Track } from "@/lib/tracks";
import { findAudioVideo } from "@/lib/video-match";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist")?.trim();
  const exclude = request.nextUrl.searchParams.get("exclude")?.trim();
  if (!artist || artist.length > 150) return NextResponse.json({ error: "Current artist is unavailable." }, { status: 400 });

  let candidates: Track[] = [];
  try {
    const params = new URLSearchParams({ term: artist, entity: "song", media: "music", limit: "25" });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      const data = await response.json();
      candidates = (data.results ?? []).filter((item: { kind: string; trackId: number; artistName: string; trackTimeMillis: number }) =>
        item.kind === "song" && String(item.trackId) !== exclude && item.trackTimeMillis > 60000 && item.trackTimeMillis < 600000 && item.artistName.toLowerCase() === artist.toLowerCase())
        .map((item: { trackId: number; trackName: string; artistName: string; collectionName: string; trackTimeMillis: number; releaseDate?: string; artworkUrl100?: string }) => ({
          id: String(item.trackId), title: item.trackName, artist: item.artistName, album: item.collectionName,
          duration: item.trackTimeMillis / 1000, year: item.releaseDate?.slice(0, 4),
          artwork: item.artworkUrl100 ? `/api/artwork?url=${encodeURIComponent(item.artworkUrl100.replace("100x100bb", "600x600bb"))}` : "",
        }));
    }
  } catch { /* Fall back to verified starters below. */ }

  for (const track of [...shuffled(candidates).slice(0, 8), ...shuffled(starterTracks.filter((song) => song.id !== exclude))]) {
    try {
      const query = new URLSearchParams({ track_name: track.title, artist_name: track.artist, album_name: track.album, duration: String(Math.round(track.duration)) });
      const response = await fetch(`https://lrclib.net/api/get?${query}`, { headers: { "User-Agent": "Versify/1.0" }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(2500) });
      if (!response.ok) continue;
      const lyrics = await response.json();
      if (!hasTimedLyrics(lyrics, track.duration)) continue;
      const videoId = await findAudioVideo(track);
      if (!videoId) continue;
      return NextResponse.json({ track: { ...track, videoId }, lyrics: { syncedLyrics: lyrics.syncedLyrics, plainLyrics: lyrics.plainLyrics ?? null, instrumental: false } }, { headers: { "Cache-Control": "no-store" } });
    } catch { /* Skip unavailable or untimed songs. */ }
  }

  return NextResponse.json({ error: "Couldn't find a related song right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
