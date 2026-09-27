import { parseLrc } from "./lyrics.ts";

export function hasTimedLyrics(data: { instrumental?: boolean; syncedLyrics?: string | null; plainLyrics?: string | null }, duration: number) {
  if (data.instrumental || typeof data.syncedLyrics !== "string") return false;
  const lines = parseLrc(data.syncedLyrics).filter((line) => line.text && line.time < duration);
  const plainLines = data.plainLyrics?.split(/\r?\n/).filter((line) => line.trim()).length ?? 0;
  return lines.length >= 5 && new Set(lines.map((line) => line.time)).size >= 5
    && lines.at(-1)!.time - lines[0].time >= 30
    // Allow different line wrapping, but reject an intro masquerading as a full LRC.
    && (!plainLines || lines.length >= plainLines * 0.7);
}
