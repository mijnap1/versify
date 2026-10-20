import { featuredMatch } from "./tracks.ts";
import { baseTitle, normalized, primaryArtist, sameArtist, titleMatch } from "./song-match.ts";
import { localizedNames } from "./catalog-names.ts";

export type VideoCandidate = {
  id: string;
  snippet: { title: string; channelTitle?: string; defaultAudioLanguage?: string };
  contentDetails: { duration: string };
  status: { embeddable: boolean };
};

type AudioTrack = { id?: string; title: string; artist: string; album?: string; language?: string | null };
export const audioLanguages: Record<string, string> = { ko: "Korean", ja: "Japanese", zh: "Chinese", en: "English", es: "Spanish", fr: "French", pt: "Portuguese" };

const versionLabels: Record<string, string> = {
  ko: "korean|kor|한국어|韓国語", ja: "japanese|jpn|日本語",
  zh: "chinese|chn|chi|mandarin|中文|国语|國語", en: "english|eng|영어",
  es: "spanish|español", fr: "french|français", pt: "portuguese|português",
};

function versionLanguage(title: string): string | null {
  for (const [code, labels] of Object.entries(versionLabels)) {
    if (new RegExp(`(?:^|[\\s([_-])(?:${labels})\\s*(?:(?:ver(?:sion)?|audio|original)\\b|版本|版|버전|[)\\]]|$)`, "i").test(title)) return code;
  }
  return null;
}

function recordingTitle(title: string) {
  // Remove only language qualifiers; keep live/remix/acoustic edition names.
  const labels = Object.values(versionLabels).join("|");
  return title.replace(new RegExp(`(?:\\b(?:${labels})\\s*(?:ver(?:sion)?\\.?|version|audio|original)|(?:${labels})\\s*(?:版本|版|버전))`, "gi"), "")
    .replace(new RegExp(`[([]\\s*(?:${labels})\\s*[)\\]]`, "gi"), "")
    .replace(/[([]\s*[)\]]/g, "").replace(/\s*[-–]\s*$/, "").trim();
}

export function isBackingTrack(title: string, channel = "") {
  // Korean "MR" marks an instrumental; it is uppercase and never "Mr." as in "Mr. Brightside".
  return /karaoke|instrumental|\binst\b|backing track|off[\s-]*vocal|without vocals|노래방|반주|カラオケ|伴奏|금영|tj\s*미디어/i.test(`${title} ${channel}`)
    || /\bMR\b(?!\.)/.test(title);
}

function verifiedBalladAudio(track: { title: string; artist: string }) {
  return ["사랑하지않아서그랬어", "becauseidontloveyou"].includes(normalized(track.title))
    && ["onestar", "임한별"].includes(normalized(track.artist)) ? "T_MhUFvlq6g" : null;
}

export function chooseAudioVideo(videos: VideoCandidate[], duration: number, track?: AudioTrack): string | null {
  const ranked = videos.filter((video) => video.status?.embeddable).map((video) => {
    const title = video.snippet.title.toLowerCase();
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(video.contentDetails.duration);
    const seconds = match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
    const difference = duration > 0 && seconds > 0 ? Math.abs(seconds - duration) : 0;
    if (!seconds || (duration > 0 && difference > 5)) return null;
    if (isBackingTrack(title, video.snippet.channelTitle)) return null;
    if (/music video|official video|\bm\/?v\b|movie clip|song scene|extended version/i.test(title)) return null;
    if (/\blive\b|\bcover\b|\bremix\b|slowed|sped up|nightcore|karaoke|reaction|instrumental|acoustic|demo version/i.test(title)
      && !/\blive\b|remix|instrumental|acoustic/i.test(track?.title ?? "")) return null;
    if (track) {
      const expected = track.language || versionLanguage(track.title);
      const version = versionLanguage(title);
      const spoken = video.snippet.defaultAudioLanguage?.split("-")[0];
      if (version && version !== expected) return null;
      if (expected && spoken && spoken !== expected) return null;
      // ponytail: metadata cannot verify sung language; require an explicit match
      // for detected lyric languages until an audio-language verifier is available.
      if (expected && version !== expected && spoken !== expected) return null;
      const requestedTitle = normalized(recordingTitle(track.title));
      if (!requestedTitle || !normalized(recordingTitle(title)).includes(requestedTitle)) return null;
      const artist = normalized(track.artist);
      if (!normalized(title).includes(artist) && !normalized(video.snippet.channelTitle ?? "").includes(artist)) return null;
    }
    let score = -difference * 3;
    if (/\blyrics?\b|\baudio\b/.test(title)) score += 30;
    if (/\bofficial audio\b/.test(title)) score += 10;
    if (/ - topic$/i.test(video.snippet.channelTitle ?? "")) score += 45;
    if (track && normalized(video.snippet.channelTitle ?? "") === normalized(track.artist)) score += 35;
    if (/music video|official video|\bm\/?v\b/.test(title)) score -= 25;
    if (/\blive\b|\bcover\b|\bremix\b|slowed|sped up|nightcore|karaoke|reaction/.test(title)) score -= 100;
    return { id: video.id, score };
  }).filter((video): video is { id: string; score: number } => video !== null);
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.id ?? null;
}

function knownAudioVideo(track: { title: string; artist: string }) {
  const ballad = verifiedBalladAudio(track);
  if (ballad) return ballad;
  const title = track.title.toLowerCase();
  const artist = track.artist.toLowerCase();
  if (title === "golden" && (artist.includes("huntr/x") || artist.includes("kpop demon hunters"))) return "9_bTl2vvYQg";
  if (normalized(title) === "galwaygirl" && normalized(artist) === "edsheeran") return "XjHr-6Zl5P8";
  if (normalized(title) === "howitsdone" && (artist.includes("huntr/x") || artist.includes("ejae"))) return "5TCOCqw1A58";
  return null;
}

export function correctedVideoId(id: string | undefined, track?: { title: string; artist: string }) {
  const ballad = track && verifiedBalladAudio(track);
  if (ballad) return ballad;
  const replacements: Record<string, string> = { "87gWaABqGYs": "XjHr-6Zl5P8", "QGsevnbItdU": "5TCOCqw1A58", "tzFadK-XJ8g": "5TCOCqw1A58", "7vCK0VBuQLs": "5TCOCqw1A58", "zWC9EOtuFY4": "5TCOCqw1A58" };
  return id ? replacements[id] ?? id : undefined;
}

export function youtubeCandidatesFromHtml(html: string): VideoCandidate[] {
  const match = /var ytInitialData = (\{[\s\S]*?\});/.exec(html);
  if (!match) return [];
  const candidates: VideoCandidate[] = [];
  const text = (value: { simpleText?: string; runs?: { text: string }[] } | undefined) => value?.simpleText ?? value?.runs?.map((run) => run.text).join("") ?? "";
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, any>;
    const video = record.videoRenderer;
    if (video?.videoId && video.lengthText) {
      const parts = text(video.lengthText).split(":").map(Number);
      const seconds = parts.reduce((total, part) => total * 60 + part, 0);
      if (Number.isFinite(seconds) && seconds > 0) candidates.push({ id: video.videoId, snippet: { title: text(video.title), channelTitle: text(video.ownerText) }, contentDetails: { duration: `PT${seconds}S` }, status: { embeddable: true } });
    }
    Object.values(record).forEach(visit);
  }
  try { visit(JSON.parse(match[1])); } catch { return []; }
  return candidates;
}

export function youtubeResultIdsFromHtml(html: string) {
  return [...new Set([...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((match) => match[1]))];
}

async function findPublicYouTubeVideo(query: string, track: AudioTrack & { duration: number }, signal?: AbortSignal) {
  try {
    const params = new URLSearchParams({ search_query: query });
    const response = await fetch(`https://www.youtube.com/results?${params}`, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 86400 }, signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]) });
    if (!response.ok) return null;
    return chooseAudioVideo(youtubeCandidatesFromHtml(await response.text()), track.duration, track);
  } catch {
    return null;
  }
}

export type MusicTrack = { id: string; title: string; artist: string; album: string; duration: number };

// YouTube Music "Songs" results are label-delivered masters: the same edit Apple lists and LRCLIB is timed against.
export function musicTracksFromResponse(data: unknown): MusicTrack[] {
  const tracks: MusicTrack[] = [];
  const text = (column: any): string => column?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((run: { text: string }) => run.text).join("") ?? "";
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    const item = (value as Record<string, any>).musicResponsiveListItemRenderer;
    if (item) {
      const id = item.playlistItemData?.videoId ?? item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
      const parts = text(item.flexColumns?.[1]).split(" • ");
      const time = parts.findLastIndex((part) => /^\d+(?::\d{2}){1,2}$/.test(part));
      if (typeof id === "string" && /^[\w-]{11}$/.test(id) && time >= 1) {
        const duration = parts[time].split(":").map(Number).reduce((total, part) => total * 60 + part, 0);
        const album = time >= 2 ? parts[time - 1] : "";
        tracks.push({ id, title: text(item.flexColumns[0]), artist: parts.slice(0, time >= 2 ? time - 1 : time).join(" • "), album, duration });
      }
      return;
    }
    Object.values(value).forEach(visit);
  }
  visit(data);
  return tracks;
}

const alteredRecording = /\b(?:live|remix|acoustic|instrumental|cover|sped up|slowed|nightcore|demo)\b/i;

export function chooseMusicTrack(tracks: MusicTrack[], track: AudioTrack & { duration: number }): string | null {
  const wanted = track.language || versionLanguage(track.title);
  const ranked = tracks.flatMap((candidate) => {
    const difference = track.duration > 0 ? Math.abs(candidate.duration - track.duration) : 0;
    if (difference > 3 || isBackingTrack(candidate.title, candidate.artist)) return [];
    if (alteredRecording.test(candidate.title) && !alteredRecording.test(track.title)) return [];
    const version = versionLanguage(candidate.title);
    if (version && version !== wanted) return [];
    const title = titleMatch(track.title, candidate.title);
    if (!title) return [];
    const [expectedAlbum, candidateAlbum] = [normalized(track.album ?? ""), normalized(candidate.album)];
    const album = !expectedAlbum || !candidateAlbum ? null : expectedAlbum === candidateAlbum ? "exact"
      : candidateAlbum.length >= 3 && expectedAlbum.length >= 3 && (expectedAlbum.includes(candidateAlbum) || candidateAlbum.includes(expectedAlbum)) ? "partial" : null;
    const artist = sameArtist(track.artist, candidate.artist);
    // Catalogs credit K-pop acts under different names (BOL4 / Bolbbalgan4 / 볼빨간사춘기);
    // the same release and length confirm it, while title and length alone could be a cover.
    if (!artist && (!album || difference > 1.5)) return [];
    return [{ id: candidate.id, score: (title === "exact" ? 30 : 0) + (album === "exact" ? 15 : album ? 10 : 0) + (artist ? 20 : 0) - difference * 10 }];
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.id ?? null;
}

async function searchMusicTracks(query: string, signal?: AbortSignal): Promise<MusicTrack[]> {
  try {
    const response = await fetch("https://music.youtube.com/youtubei/v1/search?prettyPrint=false", {
      method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0", Origin: "https://music.youtube.com" },
      body: JSON.stringify({ context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20250101.01.00", hl: "en", gl: "US" } },
        query, params: "EgWKAQIIAWoMEA4QChADEAQQCRAF" }), // "Songs" filter
      next: { revalidate: 86400 }, signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]),
    });
    return response.ok ? musicTracksFromResponse(await response.json()) : [];
  } catch { return []; }
}

async function findMusicTrack(track: AudioTrack & { duration: number }, signal?: AbortSignal) {
  const query = (names: AudioTrack) => [`${names.artist} ${names.title}`, `${primaryArtist(names.artist)} ${baseTitle(names.title)}`];
  const queries = [...new Set(query(track))];
  let variants: AudioTrack[] | undefined;
  for (let index = 0; index < queries.length; index++) {
    if (signal?.aborted) return null;
    const results = await searchMusicTracks(queries[index], signal);
    let id = chooseMusicTrack(results, track);
    // YouTube Music often returns the right song under its native name; check those before searching again.
    if (!id && !variants) {
      variants = (await localizedNames({ ...track, album: track.album ?? "" }, signal).catch(() => [])).map((names) => ({ ...track, ...names }));
      for (const variant of variants) queries.push(...query(variant).filter((item) => !queries.includes(item)));
    }
    for (const variant of variants ?? []) id ??= chooseMusicTrack(results, { ...variant, duration: track.duration });
    if (id) return id;
  }
  return null;
}

export async function findAudioVideo(track: AudioTrack & { duration: number }, signal?: AbortSignal) {
  const language = track.language || versionLanguage(track.title);
  track = { ...track, language };
  const featured = featuredMatch(track.title, track.artist);
  if (featured?.videoId && (!language || language === "en")) return featured.videoId;
  const known = knownAudioVideo(track);
  if (known && (!language || language === (verifiedBalladAudio(track) ? "ko" : "en"))) return known;

  const official = await findMusicTrack(track, signal);
  if (official) return official;

  const key = process.env.YOUTUBE_API_KEY;
  const title = `${recordingTitle(track.title)} ${language ? `${audioLanguages[language] ?? language} version` : ""}`.trim();
  const queries = [
    `${track.artist} ${title} lyrics audio`,
    `${title} ${track.artist} official audio`,
    `${track.artist} ${title} topic`,
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
      const videoId = chooseAudioVideo((await details.json()).items ?? [], track.duration, track);
      if (videoId) return videoId;
    } catch { /* Try the next query shape. */ }
  }

  for (const q of queries) {
    if (signal?.aborted) return null;
    const videoId = await findPublicYouTubeVideo(q, track, signal);
    if (videoId) return videoId;
  }

  return null;
}
