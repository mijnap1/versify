export type PlayedSong = { id: string; title: string; artist: string; videoId?: string };
export const historyLimit = 20;

function songKey(song: PlayedSong) {
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return `${normalize(song.artist)}:${normalize(song.title)}`;
}

export function wasRecentlyPlayed(song: PlayedSong, history: PlayedSong[]) {
  return history.some((played) => played.id === song.id || songKey(played) === songKey(song)
    || (!!song.videoId && played.videoId === song.videoId));
}

export function rememberSong(history: PlayedSong[], song: PlayedSong): PlayedSong[] {
  return [...history.filter((played) => !wasRecentlyPlayed(played, [song])), { id: song.id, title: song.title, artist: song.artist, videoId: song.videoId }].slice(-historyLimit);
}

export function validHistory(value: unknown): value is PlayedSong[] {
  return Array.isArray(value) && value.length <= historyLimit && value.every((song) => song && typeof song === "object"
    && typeof song.id === "string" && song.id.length <= 100
    && typeof song.title === "string" && song.title.length <= 500
    && typeof song.artist === "string" && song.artist.length <= 500
    && (song.videoId === undefined || typeof song.videoId === "string" && /^[\w-]{11}$/.test(song.videoId)));
}
