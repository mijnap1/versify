import test from "node:test";
import assert from "node:assert/strict";
import { parseLrc, activeLyricIndex, youtubeId } from "./lyrics.ts";
import { artworkPalette } from "./artwork.ts";
import { chooseAudioVideo, type VideoCandidate } from "./video-match.ts";

test("audio matching prefers album-length lyrics over music videos and altered recordings", () => {
  const video = (id: string, title: string, duration: string, embeddable = true): VideoCandidate => ({ id, snippet: { title }, contentDetails: { duration }, status: { embeddable } });
  assert.equal(chooseAudioVideo([
    video("mv", "Song Official Music Video", "PT3M50S"),
    video("slowed", "Song lyrics slowed", "PT3M20S"),
    video("lyrics", "Song Lyrics", "PT3M21S"),
    video("blocked", "Song Official Audio", "PT3M20S", false),
  ], 200), "lyrics");
  assert.equal(chooseAudioVideo([video("long", "Song Lyrics", "PT1H3M20S"), video("audio", "Song Official Audio", "PT3M20S")], 200), "audio");
  assert.equal(chooseAudioVideo([], 200), null);
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
