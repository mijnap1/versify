import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverGenreSongs, findGenre, genreMarkets, isKoreanBalladArtist, matchesGenre, otherArtist, rankPopularSongs, type CatalogSong } from "./recommendations.ts";
import { familiarityScore } from "./familiar-music.ts";

test("familiar hits outrank unfamiliar chart entries without crossing genres", () => {
  assert.ok(familiarityScore("K-Pop", "IVE", "LOVE DIVE") > familiarityScore("K-Pop", "IVE", "Album track"));
  assert.ok(familiarityScore("K-Pop", "TWICE", "FANCY") > familiarityScore("K-Pop", "Unknown artist", "Song"));
  assert.equal(familiarityScore("Pop", "aespa", "Drama"), 0);
  assert.ok(familiarityScore("Pop", "Ed Sheeran", "Shape of You") > 0);
});

test("popularity preserves chart rank, combines regional scores and puts unranked songs last", () => {
  const song = (trackId: number, popularity?: number): CatalogSong => ({ trackId, popularity, kind: "song", trackName: "Song", artistName: "Artist", collectionName: "Album", trackTimeMillis: 180000 });
  const ranked = rankPopularSongs([song(3), song(2, .1), song(1, .2), song(2, .15)]);
  assert.deepEqual(ranked.map((song) => song.trackId), [2, 1, 3]);
  assert.equal(ranked[0].popularity, .25);
});

test("recommendations stay in genre and exclude the current artist", () => {
  assert.equal(matchesGenre("K-Pop", "k-pop"), true);
  assert.equal(matchesGenre("Pop", "K-Pop"), false);
  assert.equal(matchesGenre(undefined, "K-Pop"), false);
  assert.equal(otherArtist(" AESPA ", "aespa"), false);
  assert.equal(otherArtist("TWICE", "aespa"), true);
  assert.equal(matchesGenre("Hip Hop/Rap", "Hip-Hop/Rap"), true);
});

test("discovery uses catalog charts for any genre, filters unrelated artists and tolerates a failed region", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const name of ["Pop", "Hip-Hop/Rap", "K-Pop", "J-Pop", "C-Pop", "Mandopop", "Cantopop/HK-Pop", "French Pop", "Bollywood", "Jazz", "Country", "Electronic", "Metal", "Latin", "Classical", "Unlisted new genre"]) {
      const song = (id: number, artist: string, genre = name) => ({ kind: "song", trackId: id, trackName: "Song", artistName: artist, primaryGenreName: genre, trackTimeMillis: 180000 });
      const genres = { "34": { id: "34", name: "Music", subgenres: { "11": { id: "11", name, subgenres: { "99": { id: "99", name: "Subgenre" } } } } } };
      assert.equal(findGenre(genres, "Subgenre")?.id, "99");
      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        if (url.pathname.includes("genres")) return Response.json(genres);
        if (url.pathname.includes("/gb/rss")) return new Response(null, { status: 503 });
        if (url.pathname.includes("rss")) {
          assert.ok(url.pathname.includes("genre=11"));
          return Response.json({ feed: { entry: [2, 3, 4, 5].map((id) => ({ id: { attributes: { "im:id": String(id) } } })) } });
        }
        if (url.searchParams.get("id") === "1") return Response.json({ results: [song(1, "Current")] });
        return Response.json({ results: [song(2, "New artist"), song(3, "Current"), song(4, "Unrelated", "Wrong genre"), song(5, "Subgenre artist", "Subgenre")] });
      };
      assert.deepEqual((await discoverGenreSongs("Current", "1")).map((song) => song.trackId), [2]);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("regional styles use relevant charts, without limiting supported genres", () => {
  assert.equal(genreMarkets("J-Pop")[0], "jp");
  assert.deepEqual(genreMarkets("Mandopop"), ["tw", "hk", "sg"]);
  assert.equal(genreMarkets("Cantopop/HK-Pop")[0], "tw");
  assert.equal(genreMarkets("French Pop")[0], "fr");
  assert.equal(genreMarkets("Bollywood")[0], "in");
  assert.ok(genreMarkets("New catalog genre").length);
});

test("Onestar ballads cannot lead to idol pop despite the shared K-Pop label", async () => {
  const originalFetch = globalThis.fetch;
  assert.equal(isKoreanBalladArtist("임한별"), true);
  assert.equal(isKoreanBalladArtist("NewJeans"), false);
  const song = (trackId: number, artistName: string) => ({ kind: "song", trackId, trackName: "Song", artistName, primaryGenreName: "K-Pop", trackTimeMillis: 180000 });
  try {
    globalThis.fetch = async (input) => Response.json({ results: String(input).includes("/lookup?")
      ? [song(1, "Onestar")]
      : [song(2, "NewJeans"), song(3, "Onestar"), song(4, "Davichi"), song(5, "Paul Kim")] });
    assert.deepEqual((await discoverGenreSongs("Onestar", "1")).map((song) => song.artistName), ["Davichi", "Paul Kim"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("metadata fallback matches the song title instead of another release by the artist", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ results: [{ artistName: "Current", trackName: "Different song", primaryGenreName: "K-Pop" }] });
    assert.deepEqual(await discoverGenreSongs("Current", "non-numeric-id", "My ballad"), []);
  } finally { globalThis.fetch = originalFetch; }
});

test("Taiwan-only recordings resolve their genre and exclude translated aliases of the same artist", async () => {
  const originalFetch = globalThis.fetch;
  const song = (trackId: number, artistId: number, artistName: string) => ({ kind: "song", trackId, artistId, artistName, primaryGenreName: "Mandopop", trackTimeMillis: 180000 });
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("genres")) return Response.json({ "1253": { id: "1253", name: "Mandopop" } });
      if (url.pathname.includes("rss")) return Response.json({ feed: { entry: [{ id: { attributes: { "im:id": "2" } } }, { id: { attributes: { "im:id": "3" } } }] } });
      assert.equal(url.searchParams.get("lang"), "en_us");
      if (url.pathname === "/search") return Response.json({ results: [] });
      if (url.searchParams.get("id") === "1") return Response.json({ results: url.searchParams.get("country") === "tw" ? [song(1, 10, "周杰倫")] : [] });
      return Response.json({ results: [song(2, 10, "Jay Chou"), song(3, 20, "JJ Lin")] });
    };
    assert.deepEqual((await discoverGenreSongs("周杰倫", "1", "七里香")).map((song) => song.artistName), ["JJ Lin"]);
  } finally { globalThis.fetch = originalFetch; }
});
