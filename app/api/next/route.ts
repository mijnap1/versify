import { NextRequest, NextResponse } from "next/server";
import { hasTimedLyrics } from "@/lib/starter";
import { type Track } from "@/lib/tracks";
import { findAudioVideo } from "@/lib/video-match";

import { discoverGenreSongs, variedRecommendations } from "@/lib/recommendations";
import { validHistory, wasRecentlyPlayed } from "@/lib/playback-history";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid next-song request." }, { status: 400 }); }
  const { artist, title, exclude, recent = [] } = body ?? {};
  if (typeof artist !== "string" || !artist.trim() || artist.length > 150 || typeof title !== "string" || title.length > 250
    || typeof exclude !== "string" || exclude.length > 100 || !validHistory(recent)) return NextResponse.json({ error: "Invalid next-song request." }, { status: 400 });

  let candidates: Track[] = [];
  try {
    const related = (await discoverGenreSongs(artist, exclude, title)).filter((song) => !wasRecentlyPlayed({ id: String(song.trackId), title: song.trackName, artist: song.artistName }, recent));
    candidates = variedRecommendations(related, recent.map((song) => song.artist))
      .map((song) => ({
        id: String(song.trackId), title: song.trackName, artist: song.artistName, album: song.collectionName,
        duration: song.trackTimeMillis / 1000, year: song.releaseDate?.slice(0, 4),
        artwork: song.artworkUrl100 ? `/api/artwork?url=${encodeURIComponent(song.artworkUrl100.replace("100x100bb", "600x600bb"))}` : "",
      })).filter((song) => !wasRecentlyPlayed(song, recent));
  } catch { /* Report no related song rather than jumping to an unrelated starter. */ }

  const queue = candidates.slice(0, 12);
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
    if (wasRecentlyPlayed({ ...track, videoId }, recent)) throw new Error("Recently played recording");
    return { track: { ...track, videoId }, lyrics: { syncedLyrics: lyrics.syncedLyrics, plainLyrics: lyrics.plainLyrics ?? null, instrumental: false } };
  }
  try {
    // Preserve the weighted selection order rather than favoring the fastest response.
    while (queue.length && !signal.aborted) {
      const results = await Promise.allSettled(queue.splice(0, 3).map(prepare));
      const next = results.find((result) => result.status === "fulfilled");
      if (next?.status === "fulfilled") return NextResponse.json(next.value, { headers: { "Cache-Control": "no-store" } });
    }
  } catch { /* All candidates failed. */ }
  finally { controller.abort(); }

  return NextResponse.json({ error: "Couldn't find a related song right now." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
