import { NextRequest, NextResponse } from "next/server";
import { featuredMatch } from "@/lib/tracks";
import { chooseAudioVideo } from "@/lib/video-match";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");
  const artist = request.nextUrl.searchParams.get("artist");
  if (!title || !artist || title.length > 200 || artist.length > 200) return NextResponse.json({ error: "Invalid track." }, { status: 400 });
  const featured = featuredMatch(title, artist);
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json(featured ? { videoId: featured.videoId } : { needsLink: true });
  const duration = Number(request.nextUrl.searchParams.get("duration") ?? 0);
  if (!Number.isFinite(duration) || duration < 0 || duration > 86400) return NextResponse.json({ error: "Invalid duration." }, { status: 400 });
  try {
    const query = new URLSearchParams({ key, part: "snippet", type: "video", videoEmbeddable: "true", maxResults: "8", q: `${artist} ${title} lyrics audio` });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${query}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Video search unavailable");
    const data = await response.json();
    const ids = (data.items ?? []).map((item: { id: { videoId: string } }) => item.id.videoId).filter(Boolean);
    if (!ids.length) return NextResponse.json({ needsLink: true });
    const detailsQuery = new URLSearchParams({ key, part: "snippet,contentDetails,status", id: ids.join(",") });
    const details = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsQuery}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(10000) });
    if (!details.ok) throw new Error("Video details unavailable");
    const videoId = chooseAudioVideo((await details.json()).items ?? [], duration);
    return NextResponse.json({ videoId, needsLink: !videoId });
  } catch {
    return NextResponse.json({ needsLink: true, error: "Couldn't find the audio. You can connect a YouTube link." });
  }
}
