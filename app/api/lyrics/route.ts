import { NextRequest, NextResponse } from "next/server";

import { findLyrics } from "@/lib/lyric-source";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const title = params.get("title");
  const artist = params.get("artist");
  const album = params.get("album") ?? "";
  const duration = Number(params.get("duration"));
  if (!title || !artist || title.length > 200 || artist.length > 200 || album.length > 250 || !Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: "Invalid track." }, { status: 400 });
  }
  try {
    return NextResponse.json(await findLyrics({ title, artist, album, duration }, request.signal));
  } catch {
    return NextResponse.json({ error: "Lyrics couldn't be loaded. Please try again." }, { status: 502 });
  }
}
