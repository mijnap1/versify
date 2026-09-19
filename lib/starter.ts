import { parseLrc } from "./lyrics.ts";

export function hasTimedLyrics(data: { instrumental?: boolean; syncedLyrics?: string | null }, duration: number) {
  if (data.instrumental || typeof data.syncedLyrics !== "string") return false;
  const lines = parseLrc(data.syncedLyrics).filter((line) => line.text && line.time < duration);
  return lines.length >= 5 && new Set(lines.map((line) => line.time)).size >= 5
    && lines.at(-1)!.time - lines[0].time >= 30;
}
