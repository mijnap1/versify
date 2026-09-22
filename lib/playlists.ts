import type { Track } from "./tracks.ts";

export type Playlist = { id: string; name: string; tracks: Track[] };
export type PlaylistQueue = Playlist & { index: number; failed: string[] };
export type RepeatMode = "off" | "playlist" | "song";
export function nextRepeatMode(mode: RepeatMode, inPlaylist: boolean): RepeatMode {
  return mode === "off" ? (inPlaylist ? "playlist" : "song") : mode === "playlist" && inPlaylist ? "song" : "off";
}

export function isSavedTrack(value: unknown): value is Track {
  if (!value || typeof value !== "object") return false;
  const song = value as Track;
  return [song.id, song.title, song.artist, song.album, song.artwork].every((field) => typeof field === "string")
    && Number.isFinite(song.duration) && song.duration >= 0
    && (song.videoId === undefined || typeof song.videoId === "string" && /^[\w-]{11}$/.test(song.videoId));
}

export function readPlaylists(value: unknown): Playlist[] {
  if (!Array.isArray(value)) throw new Error("Invalid saved playlists");
  const ids = new Set<string>();
  return value.filter((item): item is Playlist => item && typeof item.id === "string" && item.id !== "favorites"
    && typeof item.name === "string" && item.name.trim().length > 0 && Array.isArray(item.tracks))
    .filter((item) => { if (ids.has(item.id)) return false; ids.add(item.id); return true; })
    .map((item) => ({ id: item.id, name: item.name.trim().slice(0, 60), tracks: uniqueTracks(item.tracks.filter(isSavedTrack)) }));
}

export function uniqueTracks(tracks: Track[]) {
  return tracks.filter((track, index) => tracks.findIndex((other) => other.id === track.id) === index);
}

export function startPlaylist(playlist: Playlist, shuffle = false, startId?: string): PlaylistQueue {
  const tracks = uniqueTracks(playlist.tracks);
  if (shuffle) for (let i = tracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  }
  return { ...playlist, tracks, index: Math.max(0, tracks.findIndex((song) => song.id === startId)), failed: [] };
}

export function nextPlaylistEntries(queue: PlaylistQueue, repeat: boolean) {
  const indices = queue.tracks.map((_, index) => index);
  return [...indices.slice(queue.index + 1), ...(repeat ? indices.slice(0, queue.index + 1) : [])]
    .filter((index) => !queue.failed.includes(queue.tracks[index].id))
    .map((index) => ({ track: queue.tracks[index], index }));
}

// Keep the current song playing when it is removed, but omit removed songs from the rest of the queue.
export function syncPlaylistQueue(queue: PlaylistQueue | null, playlist: Playlist | undefined) {
  if (!queue || !playlist || queue.id !== playlist.id) return null;
  const current = queue.tracks[queue.index];
  const tracks = queue.tracks.filter((song) => song.id === current.id || playlist.tracks.some((saved) => saved.id === song.id));
  return { ...queue, name: playlist.name, tracks, index: tracks.findIndex((song) => song.id === current.id) };
}
