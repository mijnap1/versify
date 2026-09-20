import { NextRequest, NextResponse } from "next/server";
import { findAudioVideo } from "@/lib/video-match";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");
  const artist = request.nextUrl.searchParams.get("artist");
  if (!title || !artist || title.length > 200 || artist.length > 200) return NextResponse.json({ error: "Invalid track." }, { status: 400 });
  const duration = Number(request.nextUrl.searchParams.get("duration") ?? 0);
  if (!Number.isFinite(duration) || duration < 0 || duration > 86400) return NextResponse.json({ error: "Invalid duration." }, { status: 400 });
  const videoId = await findAudioVideo({ title, artist, duration });
  return NextResponse.json(videoId ? { videoId } : { needsLink: true, error: "Couldn't find the audio. You can connect a YouTube link." });
}
