export type LyricLine = { time: number; text: string };

// Use the original vocal text, never the user's translation setting or genre.
export function lyricLanguage(lyrics: { syncedLyrics?: string | null; plainLyrics?: string | null }): string | null {
  const text = (lyrics.syncedLyrics || lyrics.plainLyrics || "").replace(/\[[^\]]*\]/g, "");
  if ((text.match(/\p{Script=Hangul}/gu) ?? []).length >= 4) return "ko";
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return "ja";
  if ((text.match(/\p{Script=Han}/gu) ?? []).length >= 4) return "zh";
  // Latin script alone cannot distinguish English, Spanish, romanized Korean, etc.
  return null;
}

export function parseLrc(lrc: string): LyricLine[] {
  const offset = Number(lrc.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000;
  return lrc.split(/\r?\n/).flatMap((line) => {
    const tags = [...line.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/\[[^\]]*\]/g, "").trim();
    return tags.map((tag) => ({
      time: Math.max(0, Number(tag[1]) * 60 + Number(tag[2]) + Number(`0.${tag[3] ?? 0}`) + offset),
      text,
    }));
  }).sort((a, b) => a.time - b.time);
}

export function activeLyricIndex(lines: LyricLine[], time: number): number {
  let left = 0;
  let right = lines.length - 1;
  let active = -1;
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    if (lines[middle].time <= time) { active = middle; left = middle + 1; }
    else right = middle - 1;
  }
  return active;
}

export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function youtubeId(input: string): string | null {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const id = host === "youtu.be" ? url.pathname.slice(1) :
      ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host) ?
        url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1] : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
