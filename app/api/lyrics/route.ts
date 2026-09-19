import { NextRequest, NextResponse } from "next/server";

type Lyrics = { trackName: string; artistName: string; duration: number; syncedLyrics: string | null; plainLyrics: string | null; instrumental: boolean };

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
    const exactQuery = new URLSearchParams({ track_name: title, artist_name: artist, album_name: album, duration: String(Math.round(duration)) });
    const exact = await fetch(`https://lrclib.net/api/get?${exactQuery}`, {
      headers: { "User-Agent": "Versify/1.0" }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000),
    });
    if (exact.ok) {
      const match: Lyrics = await exact.json();
      if (match.syncedLyrics || match.plainLyrics || match.instrumental) return NextResponse.json({ syncedLyrics: match.syncedLyrics, plainLyrics: match.plainLyrics, instrumental: match.instrumental });
    }
    if (!exact.ok && exact.status !== 404) throw new Error("Lyrics service unavailable");
    const query = new URLSearchParams({ track_name: title, artist_name: artist });
    const response = await fetch(`https://lrclib.net/api/search?${query}`, {
      headers: { "User-Agent": "Versify/1.0" }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Lyrics service unavailable");
    const data: Lyrics[] = await response.json();
    const matches = data.filter((item) => item.trackName.toLowerCase() === title.toLowerCase() && item.artistName.toLowerCase() === artist.toLowerCase());
    matches.sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration));
    const close = matches.filter((item) => Math.abs(item.duration - duration) < 5);
    const match = close.find((item) => item.syncedLyrics) ?? close[0];
    return NextResponse.json(match ? { syncedLyrics: match.syncedLyrics, plainLyrics: match.plainLyrics, instrumental: match.instrumental } : { syncedLyrics: null, plainLyrics: null, instrumental: false });
  } catch {
    return NextResponse.json({ error: "Lyrics couldn't be loaded. Please try again." }, { status: 502 });
  }
}
