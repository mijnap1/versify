import { test } from "node:test";
import assert from "node:assert/strict";
import { historyLimit, rememberSong, validHistory, wasRecentlyPlayed } from "./playback-history.ts";

test("autoplay excludes both sides of a two-song cycle and alternate album listings", () => {
  const a = { id: "1", title: "Bad", artist: "ATEEZ" };
  const b = { id: "2", title: "Golden", artist: "HUNTR/X", videoId: "9_bTl2vvYQg" };
  const history = rememberSong(rememberSong([], a), b);
  assert.equal(wasRecentlyPlayed(a, history), true);
  assert.equal(wasRecentlyPlayed({ ...b, id: "another-album" }, history), true);
  assert.equal(wasRecentlyPlayed({ ...b, id: "translated", title: "골든" }, history), true);
  assert.equal(wasRecentlyPlayed({ id: "3", title: "FANCY", artist: "TWICE" }, history), false);
  assert.equal(rememberSong(history, a).length, 2);
  let recent = history;
  for (let index = 0; index < 25; index++) recent = rememberSong(recent, { id: String(index + 100), title: `Song ${index}`, artist: "Artist" });
  assert.equal(recent.length, historyLimit);
  assert.equal(validHistory(recent), true);
  assert.equal(validHistory([...recent, a]), false);
  assert.equal(validHistory([{ id: 1 }]), false);
});
