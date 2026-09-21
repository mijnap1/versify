type Genre = { id: string; name: string; subgenres?: Record<string, Genre> };
export type CatalogSong = { kind: string; trackId: number; trackName: string; artistName: string; collectionName: string; trackTimeMillis: number; primaryGenreName?: string; releaseDate?: string; artworkUrl100?: string };

// Apple groups these ballad artists under K-Pop; keep that style separate from idol pop.
const koreanBalladArtists = [
  ["Onestar", "임한별"], ["Sung Si Kyung", "성시경"], ["Huh Gak", "허각"],
  ["K.Will", "케이윌"], ["Davichi", "다비치"], ["Paul Kim", "폴킴"],
  ["MeloMance", "멜로망스"], ["Kim Na Young", "김나영"], ["Zia", "지아"],
  ["Kassy", "케이시"], ["Han Dong Geun", "한동근"], ["Hwang Chi Yeul", "황치열"],
  ["2am"], ["HYNN", "박혜원"], ["Monday Kiz", "먼데이 키즈"],
];
export function isKoreanBalladArtist(artist: string) {
  return koreanBalladArtists.some((aliases) => aliases.some((alias) => !otherArtist(alias, artist)));
}

export function findGenre(tree: Record<string, Genre>, name: string): Genre | undefined {
  const direct = Object.values(tree).find((genre) => matchesGenre(genre.name, name));
  if (direct) return direct;
  for (const genre of Object.values(tree)) {
    const child = findGenre(genre.subgenres ?? {}, name);
    if (child) return child;
  }
}

export function matchesGenre(candidate: string | undefined, genre: string) {
  const normalize = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return !!candidate && normalize(candidate) === normalize(genre);
}

export function otherArtist(candidate: string, artist: string) {
  return candidate.trim().toLowerCase() !== artist.trim().toLowerCase();
}

async function catalog(url: string) {
  const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Music catalog unavailable");
  return response.json();
}

export async function discoverGenreSongs(artist: string, exclude?: string, title?: string): Promise<CatalogSong[]> {
  // Prefer the actual recording's genre; artist catalogs can span several genres.
  let current: CatalogSong | undefined;
  if (exclude && /^\d+$/.test(exclude)) {
    try { current = (await catalog(`https://itunes.apple.com/lookup?id=${exclude}`)).results?.[0]; }
    catch { /* Search metadata if this recording's lookup is unavailable. */ }
  }
  if (!current?.primaryGenreName) {
    const query = new URLSearchParams({ term: `${artist} ${title ?? ""}`.trim(), entity: "song", limit: "50" });
    const songs: CatalogSong[] = (await catalog(`https://itunes.apple.com/search?${query}`)).results ?? [];
    current = songs.find((song) => !otherArtist(song.artistName, artist) && song.primaryGenreName && (!title || song.trackName.toLowerCase() === title.toLowerCase()));
  }
  if (!current?.primaryGenreName) return [];
  if (isKoreanBalladArtist(artist)) {
    const peers = koreanBalladArtists.filter((aliases) => aliases.every((alias) => otherArtist(alias, artist)));
    const offset = Math.floor(Math.random() * peers.length);
    const seeds = [...peers.slice(offset), ...peers.slice(0, offset)].slice(0, 4);
    const results = await Promise.allSettled(seeds.map(async ([name]) => {
      const query = new URLSearchParams({ term: name, entity: "song", limit: "25", attribute: "artistTerm" });
      return (await catalog(`https://itunes.apple.com/search?${query}`)).results as CatalogSong[];
    }));
    const seen = new Set<number>();
    return results.flatMap((result) => result.status === "fulfilled" ? result.value ?? [] : []).filter((song) => {
      if (song.kind !== "song" || seen.has(song.trackId) || String(song.trackId) === exclude || !otherArtist(song.artistName, artist)
        || !isKoreanBalladArtist(song.artistName) || /instrumental|karaoke|\(mr\)/i.test(song.trackName)
        || song.trackTimeMillis <= 60000 || song.trackTimeMillis >= 600000) return false;
      seen.add(song.trackId); return true;
    });
  }
  const genres = await catalog("https://itunes.apple.com/WebObjects/MZStoreServices.woa/ws/genres?id=34");
  const genre = findGenre(genres, current.primaryGenreName);
  if (!genre || !/^\d+$/.test(genre.id)) return [];

  // The same discovery path works for every catalog genre, including subgenres.
  const results = await Promise.allSettled(["us", "gb", "ca"].map(async (country) => {
    const chart = await catalog(`https://itunes.apple.com/${country}/rss/topsongs/limit=100/genre=${genre.id}/json`);
    const entries = chart.feed?.entry ?? [];
    const ids = (Array.isArray(entries) ? entries : [entries])
      .map((entry: { id?: { attributes?: { "im:id"?: string } } }) => entry.id?.attributes?.["im:id"])
      .filter((id: unknown): id is string => typeof id === "string" && /^\d+$/.test(id));
    if (!ids.length) return [];
    const query = new URLSearchParams({ id: ids.join(","), country });
    return (await catalog(`https://itunes.apple.com/lookup?${query}`)).results as CatalogSong[] ?? [];
  }));
  const seen = new Set<string>();
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []).filter((song) => {
    const id = String(song.trackId);
    if (song.kind !== "song" || id === exclude || seen.has(id) || !otherArtist(song.artistName, artist)
      || !matchesGenre(song.primaryGenreName, genre.name)
      || isKoreanBalladArtist(song.artistName)
      || song.trackTimeMillis <= 60000 || song.trackTimeMillis >= 600000) return false;
    seen.add(id);
    return true;
  });
}
