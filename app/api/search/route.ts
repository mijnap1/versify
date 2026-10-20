import { NextRequest, NextResponse } from "next/server";
import { normalized } from "@/lib/song-match";

type CatalogItem = {
  kind: string; trackId: number; trackName: string; artistName: string; collectionName: string;
  trackTimeMillis: number; releaseDate: string; artworkUrl100: string;
};

// Some artists are only licensed in their home storefront (back number is Japan-only),
// and the Japanese store also carries most K-pop and C-pop catalogs.
const storefronts = ["us", "jp"];

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length > 150) return NextResponse.json({ error: "Enter a song or artist." }, { status: 400 });
  const results = await Promise.allSettled(storefronts.map(async (country) => {
    const params = new URLSearchParams({ term: query, entity: "song", media: "music", limit: "12", country });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Search is temporarily unavailable.");
    return ((await response.json()).results ?? []) as CatalogItem[];
  }));
  if (results.every((result) => result.status === "rejected")) {
    return NextResponse.json({ error: "Search is unavailable right now. Try a featured track or try again." }, { status: 502 });
  }

  const seen = new Set<string>();
  const tracks = results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((item) => {
      if (item.kind !== "song") return false;
      const keys = [String(item.trackId), `${normalized(item.trackName)}:${normalized(item.artistName)}`];
      if (keys.some((key) => seen.has(key))) return false;
      keys.forEach((key) => seen.add(key));
      return true;
    })
    .map((item) => ({
      id: String(item.trackId), title: item.trackName, artist: item.artistName,
      album: item.collectionName, duration: item.trackTimeMillis / 1000,
      year: item.releaseDate?.slice(0, 4), artwork: item.artworkUrl100 ? `/api/artwork?url=${encodeURIComponent(item.artworkUrl100.replace("100x100bb", "600x600bb"))}` : "",
    }));

  // Rank results naming the searched artist first; the sort is stable, so each store's order is kept.
  const term = normalized(query);
  const covers = (text: string) => { const value = normalized(text); return !!value && !!term && (term.includes(value) || value.includes(term)); };
  const relevance = (track: { title: string; artist: string }) => (covers(track.artist) ? 2 : 0) + (covers(track.title) ? 1 : 0);
  tracks.sort((a, b) => relevance(b) - relevance(a));
  return NextResponse.json({ tracks: tracks.slice(0, 12) });
}
