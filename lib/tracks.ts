export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  year?: string;
  artwork: string;
  videoId?: string;
};

export const featuredTracks: Track[] = [
  { id: "space-song", title: "Space Song", artist: "Beach House", album: "Depression Cherry", duration: 320, year: "2015", artwork: "/covers/space-song.jpg", videoId: "RBtlPT23PTM" },
  { id: "nightcall", title: "Nightcall", artist: "Kavinsky", album: "Nightcall", duration: 258, year: "2010", artwork: "/covers/nightcall.jpg", videoId: "MV_3Dpw-BRY" },
  { id: "intro", title: "Intro", artist: "The xx", album: "xx", duration: 127, year: "2009", artwork: "/covers/intro.jpg", videoId: "xMV6l2y67rk" },
  { id: "let-it-happen", title: "Let It Happen", artist: "Tame Impala", album: "Currents", duration: 467, year: "2015", artwork: "/covers/let-it-happen.jpg", videoId: "odeHP8N4LKc" },
];

export function featuredMatch(title: string, artist: string) {
  return featuredTracks.find((track) => track.title.toLowerCase() === title.toLowerCase() && track.artist.toLowerCase() === artist.toLowerCase());
}

// Only recordings verified to have a complete synchronized lyric response.
export const starterTracks = featuredTracks.filter((track) =>
  track.id === "space-song" || track.id === "let-it-happen");
