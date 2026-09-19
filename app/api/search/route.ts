import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length > 150) return NextResponse.json({ error: "Enter a song or artist." }, { status: 400 });
  try {
    const params = new URLSearchParams({ term: query, entity: "song", media: "music", limit: "12" });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Search is temporarily unavailable.");
    const data = await response.json();
    const tracks = data.results.filter((item: { kind: string }) => item.kind === "song").map((item: {
      trackId: number; trackName: string; artistName: string; collectionName: string;
      trackTimeMillis: number; releaseDate: string; artworkUrl100: string;
    }) => ({
      id: String(item.trackId), title: item.trackName, artist: item.artistName,
      album: item.collectionName, duration: item.trackTimeMillis / 1000,
      year: item.releaseDate?.slice(0, 4), artwork: item.artworkUrl100 ? `/api/artwork?url=${encodeURIComponent(item.artworkUrl100.replace("100x100bb", "600x600bb"))}` : "",
    }));
    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now. Try a featured track or try again." }, { status: 502 });
  }
}
