// Editorial anchors complement short-term regional charts, which can favor niche releases.
// These are recognizable catalog hits, not claimed streaming-count measurements.
export const familiarHits: Record<string, [artist: string, title: string][]> = {
  kpop: [["IVE", "LOVE DIVE"], ["aespa", "Drama"], ["TWICE", "FANCY"], ["BTS", "Dynamite"], ["BLACKPINK", "How You Like That"], ["NewJeans", "Super Shy"], ["LE SSERAFIM", "ANTIFRAGILE"], ["SEVENTEEN", "Super"], ["MAMAMOO", "HIP"], ["(G)I-DLE", "Queencard"], ["Stray Kids", "God's Menu"], ["ITZY", "WANNABE"], ["Red Velvet", "Psycho"], ["EXO", "Love Shot"], ["BIGBANG", "BANG BANG BANG"], ["NMIXX", "Love Me Like This"]],
  jpop: [["YOASOBI", "アイドル"], ["Kenshi Yonezu", "Lemon"], ["Vaundy", "怪獣の花唄"], ["Ado", "新時代"], ["Official HIGE DANdism", "Pretender"], ["Yorushika", "ただ君に晴れ"]],
  mandopop: [["周杰倫", "七里香"], ["林俊傑", "修煉愛情"], ["孫燕姿", "遇見"], ["五月天", "突然好想你"], ["鄧紫棋", "光年之外"], ["蔡依林", "日不落"]],
  cantopophkpop: [["陳奕迅", "富士山下"], ["張學友", "吻別"], ["Beyond", "海闊天空"], ["容祖兒", "心淡"]],
  pop: [["Taylor Swift", "Cruel Summer"], ["Ariana Grande", "we can't be friends (wait for your love)"], ["Dua Lipa", "Levitating"], ["Sabrina Carpenter", "Espresso"], ["Bruno Mars", "Just the Way You Are"], ["Ed Sheeran", "Shape of You"], ["Adele", "Hello"], ["Harry Styles", "As It Was"], ["Billie Eilish", "BIRDS OF A FEATHER"]],
  hiphoprap: [["Eminem", "Without Me"], ["Kendrick Lamar", "HUMBLE."], ["Drake", "God's Plan"], ["Travis Scott", "SICKO MODE"], ["J. Cole", "No Role Modelz"], ["Post Malone", "rockstar (feat. 21 Savage)"]],
  rbsoul: [["SZA", "Kill Bill"], ["The Weeknd", "Blinding Lights"], ["Frank Ocean", "Thinkin Bout You"], ["Daniel Caesar", "Best Part (feat. H.E.R.)"], ["Usher", "U Got It Bad"]],
  rock: [["Queen", "Don't Stop Me Now"], ["Coldplay", "Viva La Vida"], ["Linkin Park", "In the End"], ["The Killers", "Mr. Brightside"], ["Oasis", "Wonderwall"]],
  alternative: [["Arctic Monkeys", "I Wanna Be Yours"], ["Tame Impala", "The Less I Know the Better"], ["Lana Del Rey", "Summertime Sadness"], ["Beach House", "Space Song"], ["Radiohead", "Creep"]],
  country: [["Dolly Parton", "Jolene"], ["Luke Combs", "Fast Car"], ["Chris Stapleton", "Tennessee Whiskey"], ["Shania Twain", "You're Still the One"]],
  dance: [["Avicii", "Wake Me Up"], ["Calvin Harris", "Summer"], ["Daft Punk", "One More Time"], ["Zedd", "Clarity (feat. Foxes)"]],
};

export const musicKey = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const japaneseArtistAliases = [
  ["Kenshi Yonezu", "米津玄師"], ["Yorushika", "ヨルシカ"],
  ["Official HIGE DANdism", "Official髭男dism"], ["Fujii Kaze", "藤井風"],
  ["Aimyon", "あいみょん"], ["Yuuri", "優里"], ["Vaundy"], ["YOASOBI"], ["Ado"],
];
export function artistKey(artist: string) {
  return musicKey(japaneseArtistAliases.find((aliases) => aliases.some((alias) => musicKey(alias) === musicKey(artist)))?.[0] ?? artist);
}
export function isJapanesePopArtist(artist: string) {
  return japaneseArtistAliases.some(([name]) => artistKey(name) === artistKey(artist));
}
export function isJapanesePopGenre(genre: string | undefined, artist: string) {
  return musicKey(genre ?? "") === "jpop" || (isJapanesePopArtist(artist) && ["rock", "pop", "alternative", "anime"].includes(musicKey(genre ?? "")));
}
export function hitsForGenre(genre: string) {
  const key = musicKey(genre);
  return familiarHits[key === "cpop" ? "mandopop" : key] ?? [];
}

export function familiarityScore(genre: string, artist: string, title: string) {
  const hits = hitsForGenre(genre).filter(([name]) => artistKey(name) === artistKey(artist));
  return hits.some(([, hit]) => musicKey(hit) === musicKey(title)) ? 8 : hits.length ? 4 : 0;
}
