import { NextRequest, NextResponse } from "next/server";
import { audioLanguages, findAudioVideo } from "@/lib/video-match";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");
  const artist = request.nextUrl.searchParams.get("artist");
  if (!title || !artist || title.length > 200 || artist.length > 200) return NextResponse.json({ error: "Invalid track." }, { status: 400 });
  const duration = Number(request.nextUrl.searchParams.get("duration") ?? 0);
  const language = request.nextUrl.searchParams.get("language");
  const album = request.nextUrl.searchParams.get("album")?.slice(0, 250) ?? "";
  const id = request.nextUrl.searchParams.get("id") ?? undefined;
  if (language && !Object.hasOwn(audioLanguages, language)) return NextResponse.json({ error: "Invalid lyric language." }, { status: 400 });
  if (!Number.isFinite(duration) || duration < 0 || duration > 86400) return NextResponse.json({ error: "Invalid duration." }, { status: 400 });
  const videoId = await findAudioVideo({ id: id && /^\d{1,20}$/.test(id) ? id : undefined, title, artist, album, duration, language }, request.signal);
  return NextResponse.json(videoId ? { videoId } : { needsLink: true, error: "Couldn't confidently match audio to these lyrics. Connect a YouTube recording in the same language and version." });
}
