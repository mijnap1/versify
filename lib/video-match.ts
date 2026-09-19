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
    if (/music video|official video|\bm\/?v\b/.test(title)) score -= 80;
    if (/\blive\b|\bcover\b|\bremix\b|slowed|sped up|nightcore|karaoke|reaction/.test(title)) score -= 100;
    return { id: video.id, score };
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.id ?? null;
}
