import test from "node:test";
import assert from "node:assert/strict";
import { readPlaylists, startPlaylist, nextPlaylistEntries, syncPlaylistQueue, nextRepeatMode } from "./playlists.ts";
import { featuredTracks } from "./tracks.ts";

test("repeat cycles playlist, song, off in a playlist and song, off outside one", () => {
  assert.equal(nextRepeatMode("off", true), "playlist");
  assert.equal(nextRepeatMode("playlist", true), "song");
  assert.equal(nextRepeatMode("song", true), "off");
  assert.equal(nextRepeatMode("off", false), "song");
  assert.equal(nextRepeatMode("song", false), "off");
  assert.equal(nextRepeatMode("playlist", false), "off");
});

test("playlist storage validates songs, deduplicates entries, and keeps favorites separate", () => {
  const saved = readPlaylists([{ id: "one", name: " Night music ", tracks: [featuredTracks[0], featuredTracks[0], { id: "bad" }] },
    { id: "favorites", name: "Invalid duplicate favorites", tracks: [] }, { id: "one", name: "Duplicate", tracks: [] }]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, "Night music");
  assert.deepEqual(saved[0].tracks, [featuredTracks[0]]);
  assert.throws(() => readPlaylists({}));
});

test("playlist ordering, starting at a song, looping, and unavailable songs have bounded next entries", () => {
  const playlist = { id: "one", name: "Night music", tracks: featuredTracks };
  const queue = startPlaylist(playlist, false, featuredTracks[1].id);
  assert.deepEqual(nextPlaylistEntries(queue, false).map((entry) => entry.index), [2, 3]);
  assert.deepEqual(nextPlaylistEntries(queue, true).map((entry) => entry.index), [2, 3, 0, 1]);
  assert.deepEqual(nextPlaylistEntries({ ...queue, index: 3 }, false), []);
  assert.deepEqual(nextPlaylistEntries({ ...queue, failed: featuredTracks.map((song) => song.id) }, true), []);
  assert.deepEqual(nextPlaylistEntries({ ...queue, failed: [featuredTracks[2].id] }, false).map((entry) => entry.index), [3]);
  const single = startPlaylist({ ...playlist, tracks: [featuredTracks[0]] });
  assert.deepEqual(nextPlaylistEntries(single, false), []);
  assert.deepEqual(nextPlaylistEntries(single, true).map((entry) => entry.index), [0]);
});

test("shuffle keeps each song once and deleting upcoming songs updates the active queue", () => {
  const playlist = { id: "one", name: "Night music", tracks: featuredTracks };
  const shuffled = startPlaylist(playlist, true);
  assert.deepEqual(shuffled.tracks.map((song) => song.id).sort(), featuredTracks.map((song) => song.id).sort());
  assert.equal(shuffled.index, 0);
  assert.deepEqual(playlist.tracks, featuredTracks);
  const queue = startPlaylist(playlist);
  const updated = syncPlaylistQueue(queue, { ...playlist, name: "Renamed", tracks: [featuredTracks[2]] })!;
  assert.equal(updated.name, "Renamed");
  assert.equal(updated.tracks[updated.index].id, featuredTracks[0].id);
  assert.deepEqual(nextPlaylistEntries(updated, false).map((entry) => entry.track.id), [featuredTracks[2].id]);
  assert.equal(syncPlaylistQueue(queue, undefined), null);
});
