import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverGenreSongs, findGenre, isKoreanBalladArtist, matchesGenre, otherArtist } from "./recommendations.ts";

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
    for (const name of ["Pop", "Hip-Hop/Rap", "K-Pop", "Jazz", "Country", "Electronic", "Metal", "Latin", "Classical", "Unlisted new genre"]) {
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
