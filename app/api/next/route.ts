import { NextRequest, NextResponse } from "next/server";
import { hasTimedLyrics } from "@/lib/starter";
import { type Track } from "@/lib/tracks";
import { findAudioVideo } from "@/lib/video-match";

import { discoverGenreSongs } from "@/lib/recommendations";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

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
  const title = request.nextUrl.searchParams.get("title")?.trim();
  const exclude = request.nextUrl.searchParams.get("exclude")?.trim();
  if (!artist || artist.length > 150 || (title?.length ?? 0) > 250 || (exclude?.length ?? 0) > 100) return NextResponse.json({ error: "Current artist is unavailable." }, { status: 400 });

  let candidates: Track[] = [];
  try {
    candidates = shuffled(await discoverGenreSongs(artist, exclude, title))
      .map((song) => ({
        id: String(song.trackId), title: song.trackName, artist: song.artistName, album: song.collectionName,
        duration: song.trackTimeMillis / 1000, year: song.releaseDate?.slice(0, 4),
        artwork: song.artworkUrl100 ? `/api/artwork?url=${encodeURIComponent(song.artworkUrl100.replace("100x100bb", "600x600bb"))}` : "",
      }));
  } catch { /* Report no related song rather than jumping to an unrelated starter. */ }

  // Try different artists first, before alternate recordings from the same artist.
  const artists = new Set<string>();
  const first = candidates.filter((song) => {
    const name = song.artist.toLowerCase();
    if (artists.has(name)) return false;
    artists.add(name); return true;
  });
  const queue = [...first, ...candidates.filter((song) => !first.includes(song))].slice(0, 12);
  const controller = new AbortController();
  const deadline = AbortSignal.timeout(18000);
  const signal = AbortSignal.any([controller.signal, request.signal, deadline]);
  async function prepare(track: Track) {
    const candidateSignal = AbortSignal.any([signal, AbortSignal.timeout(7000)]);
    const query = new URLSearchParams({ track_name: track.title, artist_name: track.artist, album_name: track.album, duration: String(Math.round(track.duration)) });
    const response = await fetch(`https://lrclib.net/api/get?${query}`, { headers: { "User-Agent": "Versify/1.0" }, next: { revalidate: 86400 }, signal: AbortSignal.any([candidateSignal, AbortSignal.timeout(2500)]) });
    if (!response.ok) throw new Error("Lyrics unavailable");
    const lyrics = await response.json();
    if (!hasTimedLyrics(lyrics, track.duration)) throw new Error("Untimed lyrics");
    const videoId = await findAudioVideo(track, candidateSignal);
    if (!videoId) throw new Error("Audio unavailable");
    return { track: { ...track, videoId }, lyrics: { syncedLyrics: lyrics.syncedLyrics, plainLyrics: lyrics.plainLyrics ?? null, instrumental: false } };
  }
  // Three workers skip failures independently; return the first fully prepared song.
  async function worker() {
    while (queue.length && !signal.aborted) {
      const track = queue.shift()!;
      try { return await prepare(track); } catch { /* Try another candidate. */ }
    }
    throw new Error("No related song available");
  }
  try {
    const next = await Promise.any([worker(), worker(), worker()]);
    return NextResponse.json(next, { headers: { "Cache-Control": "no-store" } });
  } catch { /* All candidates failed. */ }
  finally { controller.abort(); }

  return NextResponse.json({ error: "Couldn't find a related song right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
