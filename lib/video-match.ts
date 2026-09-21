import { featuredMatch } from "./tracks.ts";

export type VideoCandidate = {
  id: string;
  snippet: { title: string };
  contentDetails: { duration: string };
  status: { embeddable: boolean };
};

export function chooseAudioVideo(videos: VideoCandidate[], duration: number): string | null {
  const ranked = videos.filter((video) => video.status?.embeddable).map((video) => {
    const title = video.snippet.title.toLowerCase();
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(video.contentDetails.duration);
    const seconds = match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
    const difference = duration > 0 && seconds > 0 ? Math.abs(seconds - duration) : 0;
    let score = -difference * 3;
    if (/\blyrics?\b|\baudio\b/.test(title)) score += 30;
    if (/\bofficial audio\b/.test(title)) score += 10;
    if (/music video|official video|\bm\/?v\b/.test(title)) score -= 25;
    if (/\blive\b|\bcover\b|\bremix\b|slowed|sped up|nightcore|karaoke|reaction/.test(title)) score -= 100;
    return { id: video.id, score };
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.id ?? null;
}

function knownAudioVideo(track: { title: string; artist: string }) {
  const title = track.title.toLowerCase();
  const artist = track.artist.toLowerCase();
  if (title === "golden" && (artist.includes("huntr/x") || artist.includes("kpop demon hunters"))) return "9_bTl2vvYQg";
  return null;
}

export function youtubeResultIdsFromHtml(html: string) {
  return [...new Set([...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((match) => match[1]))];
}

async function findPublicYouTubeVideo(query: string, signal?: AbortSignal) {
  try {
    const params = new URLSearchParams({ search_query: query });
    const response = await fetch(`https://www.youtube.com/results?${params}`, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 86400 }, signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]) });
    if (!response.ok) return null;
    return youtubeResultIdsFromHtml(await response.text())[0] ?? null;
  } catch {
    return null;
  }
}

export async function findAudioVideo(track: { title: string; artist: string; duration: number }, signal?: AbortSignal) {
  const featured = featuredMatch(track.title, track.artist);
  if (featured?.videoId) return featured.videoId;
  const known = knownAudioVideo(track);
  if (known) return known;

  const key = process.env.YOUTUBE_API_KEY;
  const title = track.title.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const queries = [
    `${track.artist} ${title} lyrics audio`,
    `${title} ${track.artist} official audio`,
    `${title} lyrics audio`,
  ];

  if (key) {
    for (const q of queries) try {
      if (signal?.aborted) return null;
      const query = new URLSearchParams({ key, part: "snippet", type: "video", videoEmbeddable: "true", maxResults: "10", q });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${query}`, { next: { revalidate: 86400 }, signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]) });
      if (response.status === 403 || response.status === 429) break;
      if (!response.ok) continue;
      const data = await response.json();
      const ids = (data.items ?? []).map((item: { id: { videoId: string } }) => item.id.videoId).filter(Boolean);
      if (!ids.length) continue;

      const detailsQuery = new URLSearchParams({ key, part: "snippet,contentDetails,status", id: ids.join(",") });
      const details = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsQuery}`, { next: { revalidate: 86400 }, signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]) });
      if (!details.ok) continue;
      const videoId = chooseAudioVideo((await details.json()).items ?? [], track.duration);
      if (videoId) return videoId;
    } catch { /* Try the next query shape. */ }
  }

  for (const q of queries) {
    if (signal?.aborted) return null;
    const videoId = await findPublicYouTubeVideo(q, signal);
    if (videoId) return videoId;
  }

  return null;
}
