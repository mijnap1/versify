import test from "node:test";
import assert from "node:assert/strict";
import { parseLrc, activeLyricIndex, youtubeId } from "./lyrics.ts";
import { artworkPalette } from "./artwork.ts";
import { hasTimedLyrics } from "./starter.ts";

test("random starters require multiple distinct timed vocal lines", () => {
  const syncedLyrics = "[00:10]one\n[00:20]two\n[00:30]three\n[00:40]four\n[00:50]five";
  assert.equal(hasTimedLyrics({ syncedLyrics }, 180), true);
  assert.equal(hasTimedLyrics({ syncedLyrics, instrumental: true }, 180), false);
  assert.equal(hasTimedLyrics({ syncedLyrics: "[00:00]entire song on one line" }, 180), false);
  assert.equal(hasTimedLyrics({ syncedLyrics: "[00:10]\n[00:20]\n[00:30]\n[00:40]\n[00:50]" }, 180), false);
  assert.equal(hasTimedLyrics({ syncedLyrics }, 15), false);
  assert.equal(hasTimedLyrics({ syncedLyrics: null }, 180), false);
});
import { chooseAudioVideo, correctedVideoId, findAudioVideo, youtubeCandidatesFromHtml, youtubeResultIdsFromHtml, type VideoCandidate } from "./video-match.ts";

test("audio matching prefers album-length lyrics over music videos and altered recordings", () => {
  const video = (id: string, title: string, duration: string, embeddable = true): VideoCandidate => ({ id, snippet: { title }, contentDetails: { duration }, status: { embeddable } });
  assert.equal(chooseAudioVideo([
    video("mv", "Song Official Music Video", "PT3M50S"),
    video("slowed", "Song lyrics slowed", "PT3M20S"),
    video("lyrics", "Song Lyrics", "PT3M21S"),
    video("blocked", "Song Official Audio", "PT3M20S", false),
  ], 200), "lyrics");
  assert.equal(chooseAudioVideo([video("mv", "Song Official Music Video", "PT3M20S")], 200), null);
  assert.equal(chooseAudioVideo([video("intro", "Song Official Lyric Video", "PT3M40S")], 200), null);
  assert.equal(chooseAudioVideo([video("cover", "Song Cover", "PT3M20S")], 200), null);
  assert.equal(chooseAudioVideo([video("long", "Song Lyrics", "PT1H3M20S"), video("audio", "Song Official Audio", "PT3M20S")], 200), "audio");
  assert.equal(chooseAudioVideo([], 200), null);
});

test("known soundtrack songs bypass YouTube search quota", async () => {
  assert.equal(await findAudioVideo({ title: "Golden", artist: "HUNTR/X", duration: 197 }), "9_bTl2vvYQg");
  assert.equal(await findAudioVideo({ title: "How It’s Done", artist: "HUNTR/X", duration: 176 }), "5TCOCqw1A58");
  assert.equal(await findAudioVideo({ title: "Galway Girl", artist: "Ed Sheeran", duration: 170 }), "XjHr-6Zl5P8");
  assert.equal(correctedVideoId("87gWaABqGYs"), "XjHr-6Zl5P8");
});

test("public YouTube results use recording metadata rather than the first video ID", () => {
  const renderer = (videoId: string, title: string, duration: string) => ({ videoRenderer: { videoId, title: { runs: [{ text: title }] }, lengthText: { simpleText: duration }, ownerText: { runs: [{ text: "Artist - Topic" }] } } });
  const html = `var ytInitialData = ${JSON.stringify({ contents: [renderer("mv", "Song Official Music Video", "3:40"), renderer("wrong", "Unrelated Tune Official Audio", "3:00"), renderer("audio", "Song", "3:00")] })};`;
  const parsed = youtubeCandidatesFromHtml(html);
  assert.equal(parsed.length, 3);
  assert.equal(chooseAudioVideo(parsed, 180, { title: "Song", artist: "Artist" }), "audio");
  assert.deepEqual(youtubeCandidatesFromHtml("invalid"), []);
});

test("YouTube results page IDs are deduplicated", () => {
  assert.deepEqual(youtubeResultIdsFromHtml('{"videoId":"Din9kr5i3m4"},{"videoId":"Din9kr5i3m4"},{"videoId":"wfch4ECkeDI"}'), ["Din9kr5i3m4", "wfch4ECkeDI"]);
});

test("LRC timing preserves instrumental breaks, repeated stamps, fractions, and offsets", () => {
  const lines = parseLrc("[ar:Original demo]\n[offset:-250]\n[00:10.5][01:10.050]Second line\n[00:02.00]First line\n[00:08.000]\nuntimed");
  assert.deepEqual(lines, [{ time: 1.75, text: "First line" }, { time: 7.75, text: "" }, { time: 10.25, text: "Second line" }, { time: 69.8, text: "Second line" }]);
  assert.equal(activeLyricIndex(lines, 0), -1);
  assert.equal(activeLyricIndex(lines, 7.75), 1);
  assert.equal(activeLyricIndex(lines, 11), 2);
  assert.equal(activeLyricIndex(lines, 2), 0);
  assert.equal(activeLyricIndex([], 5), -1);
});

test("YouTube links reject unrelated hosts and malformed IDs", () => {
  assert.equal(youtubeId("https://youtu.be/RBtlPT23PTM?t=20"), "RBtlPT23PTM");
  assert.equal(youtubeId("https://www.youtube.com/watch?v=RBtlPT23PTM"), "RBtlPT23PTM");
  assert.equal(youtubeId("https://example.com/watch?v=RBtlPT23PTM"), null);
  assert.equal(youtubeId("invalid"), null);
});

test("album palettes keep the sleeve's color while ignoring white text and transparent pixels", () => {
  const colored = artworkPalette(new Uint8ClampedArray([
    160, 32, 48, 255, 160, 32, 48, 255,
    255, 255, 255, 255, 0, 255, 0, 0,
  ]));
  const channels = colored[0].match(/\d+/g)!.map(Number);
  assert.ok(channels[0] > channels[1] && channels[0] > channels[2]);
  assert.ok(channels.every((channel) => channel >= 168));
  assert.deepEqual(artworkPalette(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])), artworkPalette(new Uint8ClampedArray()));
  const blueAndPink = artworkPalette(new Uint8ClampedArray([
    50, 150, 210, 255, 50, 150, 210, 255, 50, 150, 210, 255,
    190, 215, 240, 255, 190, 215, 240, 255,
    220, 80, 160, 255, 220, 80, 160, 255,
  ]));
  const accent = blueAndPink[2].match(/\d+/g)!.map(Number);
  assert.ok(accent[0] > accent[2], "The accent should pick pink rather than pale blue cloud pixels.");
});
