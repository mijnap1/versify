// Catalogs disagree on featured artists, remaster labels, and separators; compare the song underneath.
export const normalized = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Credits lead a qualifier ("(with X)", "- feat. X"); edition labels may sit anywhere ("2015 Remaster").
const qualifier = /^(?:feat|ft|featuring|with|prod|from)\b|\b(?:remaster(?:ed)?|explicit|clean|bonus track)\b/i;

export function baseTitle(title: string) {
  return title
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (whole, inner: string) => qualifier.test(inner) ? "" : whole)
    .replace(/\s+[-–]\s+(.*)$/, (whole, tail: string) => qualifier.test(tail) ? "" : whole)
    .replace(/\s+(?:feat|ft|featuring)\b\.?\s.*$/i, "")
    .trim();
}

export function titleMatch(expected: string, candidate: string): "exact" | "partial" | null {
  const a = normalized(baseTitle(expected));
  const b = normalized(baseTitle(candidate));
  if (!a || !b) return null;
  if (a === b) return "exact";
  return b.includes(a) || a.includes(b) ? "partial" : null;
}

const separators = /\s*(?:,|&|\+|;|×|\s(?:and|x|feat\.?|ft\.?|featuring|with|vs\.?)\s)\s*/i;

export function primaryArtist(artist: string) {
  return artist.split(separators)[0]?.trim() || artist;
}

export function sameArtist(expected: string, candidate: string) {
  const names = (artist: string) => artist.split(separators).map(normalized).filter(Boolean);
  const [left, right] = [names(expected), names(candidate)];
  if (left.some((name) => right.includes(name))) return true;
  // Korean names appear in either order: "Jaehyun Lim" / "Lim Jae Hyun".
  if (left.some((name) => right.some((other) => name.length >= 4 && name.length === other.length && `${other}${other}`.includes(name)))) return true;
  // Containment catches "HUNTR/X" inside "HUNTR/X, EJAE…" without letting "IU" match "Liquid".
  const [fullLeft, fullRight] = [normalized(expected), normalized(candidate)];
  return left.some((name) => name.length >= 4 && fullRight.includes(name)) || right.some((name) => name.length >= 4 && fullLeft.includes(name));
}
