import { familiarityScore, hitsForGenre, musicKey } from "./familiar-music.ts";

type Genre = { id: string; name: string; subgenres?: Record<string, Genre> };
export type CatalogSong = { kind: string; trackId: number; trackName: string; artistName: string; artistId?: number; collectionName: string; trackTimeMillis: number; primaryGenreName?: string; releaseDate?: string; artworkUrl100?: string; popularity?: number };

export function rankPopularSongs(songs: CatalogSong[]): CatalogSong[] {
  const ranked = new Map<number, CatalogSong>();
  for (const song of songs) {
    const existing = ranked.get(song.trackId);
    ranked.set(song.trackId, { ...song, popularity: (existing?.popularity ?? 0) + (song.popularity ?? 0) });
  }
  return [...ranked.values()].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

async function chartRanks(genreId: string, country: string): Promise<string[]> {
  const chart = await catalog(`https://itunes.apple.com/${country}/rss/topsongs/limit=100/genre=${genreId}/json`);
  const entries = chart.feed?.entry ?? [];
  return (Array.isArray(entries) ? entries : [entries])
    .map((entry: { id?: { attributes?: { "im:id"?: string } } }) => entry.id?.attributes?.["im:id"])
    .filter((id: unknown): id is string => typeof id === "string" && /^\d+$/.test(id));
}

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

export function genreMarkets(genre: string): string[] {
  if (/j-pop|japanese|anime/i.test(genre)) return ["jp", "us", "tw"];
  if (/c-pop|mandopop|cantopop|chinese|tai-pop/i.test(genre)) return ["tw", "hk", "sg"];
  if (/k-pop|korean/i.test(genre)) return ["us", "jp", "tw"];
  if (/french|chanson/i.test(genre)) return ["fr", "ca", "be"];
  if (/german|deutsch|schlager/i.test(genre)) return ["de", "at", "ch"];
  if (/brazil|bossa|samba|sertanejo|mpb|forr[oó]|pagode/i.test(genre)) return ["br", "pt", "us"];
  if (/latin|reggaeton|salsa|bachata|mariachi|mexican|cumbia/i.test(genre)) return ["mx", "es", "us"];
  if (/indian|bollywood|tamil|telugu|punjabi|hindustani|carnatic/i.test(genre)) return ["in", "gb", "us"];
  if (/african|afro|amapiano|kwaito/i.test(genre)) return ["za", "ng", "gb"];
  if (/arabic|khaleeji|levant|maghreb/i.test(genre)) return ["ae", "sa", "eg"];
  if (/thai/i.test(genre)) return ["th", "tw", "us"];
  if (/indonesian|indo pop/i.test(genre)) return ["id", "sg", "us"];
  if (/pinoy|philippine/i.test(genre)) return ["ph", "sg", "us"];
  return ["us", "gb", "ca"];
}

async function catalog(url: string) {
  const endpoint = new URL(url);
  // Local storefronts otherwise return translated genre labels that cannot match the taxonomy.
  if (["/lookup", "/search"].includes(endpoint.pathname)) endpoint.searchParams.set("lang", "en_us");
  const response = await fetch(endpoint.toString(), { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
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
    try {
    const query = new URLSearchParams({ term: `${artist} ${title ?? ""}`.trim(), entity: "song", limit: "50" });
    const songs: CatalogSong[] = (await catalog(`https://itunes.apple.com/search?${query}`)).results ?? [];
    current = songs.find((song) => !otherArtist(song.artistName, artist) && song.primaryGenreName && (!title || song.trackName.toLowerCase() === title.toLowerCase()));
    } catch { /* Continue with regional catalogs if US search fails. */ }
  }
  if (!current?.primaryGenreName) {
    // Region-exclusive recordings can be missing from the default US storefront.
    const results = await Promise.allSettled(["jp", "tw", "hk", "fr", "br", "mx"].map(async (country) => {
      const numericId = exclude && /^\d+$/.test(exclude);
      const query = new URLSearchParams(numericId
        ? { id: exclude, country }
        : { term: `${artist} ${title ?? ""}`.trim(), entity: "song", limit: "25", country });
      const songs: CatalogSong[] = (await catalog(`https://itunes.apple.com/${numericId ? "lookup" : "search"}?${query}`)).results ?? [];
      return songs.find((song) => song.kind === "song" && song.primaryGenreName && (numericId
        ? String(song.trackId) === exclude
        : !otherArtist(song.artistName, artist) && (!title || song.trackName.toLowerCase() === title.toLowerCase())));
    }));
    current = results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : [])[0];
  }
  if (!current?.primaryGenreName) return [];
  if (isKoreanBalladArtist(artist)) {
    const peers = koreanBalladArtists.filter((aliases) => aliases.every((alias) => otherArtist(alias, artist)));
    const offset = Math.floor(Math.random() * peers.length);
    const seeds = [...peers.slice(offset), ...peers.slice(0, offset)].slice(0, 4);
    const ranksPromise = Promise.allSettled(genreMarkets("K-Pop").map((country) => chartRanks("51", country)));
    const results = await Promise.allSettled(seeds.map(async ([name]) => {
      const query = new URLSearchParams({ term: name, entity: "song", limit: "25", attribute: "artistTerm" });
      return (await catalog(`https://itunes.apple.com/search?${query}`)).results as CatalogSong[];
    }));
    const ranks = await ranksPromise;
    const seen = new Set<number>();
    return rankPopularSongs(results.flatMap((result) => result.status === "fulfilled" ? result.value ?? [] : []).filter((song) => {
      if (song.kind !== "song" || seen.has(song.trackId) || String(song.trackId) === exclude || !otherArtist(song.artistName, artist)
        || !isKoreanBalladArtist(song.artistName) || /instrumental|karaoke|\(mr\)/i.test(song.trackName)
        || song.trackTimeMillis <= 60000 || song.trackTimeMillis >= 600000) return false;
      seen.add(song.trackId); return true;
    }).map((song) => ({ ...song, popularity: ranks.reduce((score, result, market) => {
      const position = result.status === "fulfilled" ? result.value.indexOf(String(song.trackId)) : -1;
      return score + (position >= 0 ? (market === 0 ? 1 : .5) / (position + 1) : 0);
    }, 0) })));
  }
  const genres = await catalog("https://itunes.apple.com/WebObjects/MZStoreServices.woa/ws/genres?id=34");
  const genre = findGenre(genres, current.primaryGenreName);
  if (!genre || !/^\d+$/.test(genre.id)) return [];

  const hits = hitsForGenre(genre.name).filter(([name]) => otherArtist(name, artist));
  const offset = hits.length ? Math.floor(Math.random() * hits.length) : 0;
  const familiar = Promise.allSettled([...hits.slice(offset), ...hits.slice(0, offset)].slice(0, 4).map(async ([name, title]) => {
    const query = new URLSearchParams({ term: `${name} ${title}`, entity: "song", limit: "8", country: genreMarkets(genre.name)[0] });
    const songs: CatalogSong[] = (await catalog(`https://itunes.apple.com/search?${query}`)).results ?? [];
    return songs.filter((song) => musicKey(song.artistName) === musicKey(name) && musicKey(song.trackName) === musicKey(title));
  }));

  // The same discovery path works for every catalog genre, including subgenres.
  const results = await Promise.allSettled(genreMarkets(genre.name).map(async (country, market) => {
    const ids = await chartRanks(genre.id, country);
    if (!ids.length) return [];
    const query = new URLSearchParams({ id: ids.join(","), country });
    const songs: CatalogSong[] = (await catalog(`https://itunes.apple.com/lookup?${query}`)).results ?? [];
    return songs.map((song) => {
      const position = ids.indexOf(String(song.trackId));
      return { ...song, popularity: position >= 0 ? (market === 0 ? 1 : .5) / (position + 1) : 0 };
    });
  }));
  const seen = new Set<string>();
  const anchors = (await familiar).flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const ranked = rankPopularSongs([...results.flatMap((result) => result.status === "fulfilled" ? result.value : []), ...anchors])
    .map((song) => ({ ...song, popularity: (song.popularity ?? 0) + familiarityScore(genre.name, song.artistName, song.trackName) }))
    .sort((a, b) => b.popularity - a.popularity);
  return ranked.filter((song) => {
    const id = String(song.trackId);
    if (song.kind !== "song" || id === exclude || seen.has(id) || !otherArtist(song.artistName, artist)
      || (current?.artistId !== undefined && song.artistId === current.artistId)
      || !matchesGenre(song.primaryGenreName, genre.name)
      || isKoreanBalladArtist(song.artistName)
      || song.trackTimeMillis <= 60000 || song.trackTimeMillis >= 600000) return false;
    seen.add(id);
    return true;
  });
}
