import test from "node:test";
import assert from "node:assert/strict";
import { parseLrc, activeLyricIndex, youtubeId, lyricLanguage } from "./lyrics.ts";
import { artworkPalette } from "./artwork.ts";
import { hasTimedLyrics } from "./starter.ts";
import { findLyrics } from "./lyric-source.ts";

test("incomplete exact lyrics yield to a complete timed recording match", async (t) => {
  const incomplete = { trackName: "Pretty Please", artistName: "Hearts2Hearts", duration: 205,
    syncedLyrics: "[00:02]Girls, you ready?", plainLyrics: "Intro\nSecond\nThird\nFourth\nFifth\nSixth", instrumental: false };
  const complete = { ...incomplete, duration: 204, syncedLyrics: "[00:02]Intro\n[00:30]Second\n[01:00]Third\n[01:30]Fourth\n[02:00]Fifth\n[03:00]Sixth" };
  const mock = t.mock.method(globalThis, "fetch", async (input: string | URL | Request) =>
    Response.json(String(input).includes("/get?") ? incomplete : [incomplete, { ...complete, artistName: "Other Artist" }, { ...complete, duration: 260 }, complete]));
  const result = await findLyrics({ title: "Pretty Please", artist: "Hearts2Hearts", album: "FOCUS", duration: 205 });
  assert.equal(result.syncedLyrics, complete.syncedLyrics);
  assert.equal(mock.mock.callCount(), 2);
});

test("incomplete timing falls back to full plain lyrics, including when search fails", async (t) => {
  const incomplete = { trackName: "Song", artistName: "Artist", duration: 200,
    syncedLyrics: "[00:02]Intro", plainLyrics: "Intro\nSecond\nThird\nFourth\nFifth\nSixth", instrumental: false };
  let failSearch = false;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => /\/get(?:-cached)?\?/.test(String(input))
    ? Response.json(incomplete) : failSearch ? new Response(null, { status: 502 }) : Response.json([incomplete]));
  const track = { title: "Song", artist: "Artist", album: "Album", duration: 200 };
  assert.deepEqual(await findLyrics(track), { syncedLyrics: null, plainLyrics: incomplete.plainLyrics, instrumental: false });
  failSearch = true;
  assert.deepEqual(await findLyrics(track), { syncedLyrics: null, plainLyrics: incomplete.plainLyrics, instrumental: false });
});

test("an intro with several timestamps is still incomplete against the full lyrics", () => {
  assert.equal(hasTimedLyrics({ syncedLyrics: "[00:02]Intro\n[00:10]Two\n[00:20]Three\n[00:30]Four\n[00:40]Five",
    plainLyrics: Array.from({ length: 70 }, (_, index) => `Line ${index}`).join("\n") }, 205), false);
});

test("random starters require multiple distinct timed vocal lines", () => {
  const syncedLyrics = "[00:10]one\n[00:20]two\n[00:30]three\n[00:40]four\n[00:50]five";
  assert.equal(hasTimedLyrics({ syncedLyrics }, 180), true);
  assert.equal(hasTimedLyrics({ syncedLyrics, instrumental: true }, 180), false);
  assert.equal(hasTimedLyrics({ syncedLyrics: "[00:00]entire song on one line" }, 180), false);
  assert.equal(hasTimedLyrics({ syncedLyrics: "[00:10]\n[00:20]\n[00:30]\n[00:40]\n[00:50]" }, 180), false);
  assert.equal(hasTimedLyrics({ syncedLyrics }, 15), false);
  assert.equal(hasTimedLyrics({ syncedLyrics: null }, 180), false);
});
import { chooseAudioVideo, chooseMusicTrack, correctedVideoId, findAudioVideo, isBackingTrack, musicTracksFromResponse, youtubeCandidatesFromHtml, youtubeResultIdsFromHtml, type VideoCandidate } from "./video-match.ts";
import { baseTitle, primaryArtist, sameArtist, titleMatch } from "./song-match.ts";
import { rankLyricEntries } from "./lyric-source.ts";

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

test("lyric language uses original text, ignores LRC metadata, and keeps Latin text unknown", () => {
  assert.equal(lyricLanguage({ syncedLyrics: "[ar:English]\n[00:10]차갑도록 서롤 겨눈 채\n[00:20]It's the love shot" }), "ko");
  assert.equal(lyricLanguage({ plainLyrics: "君の声が聞こえる夜" }), "ja");
  assert.equal(lyricLanguage({ plainLyrics: "世界中の未来" }), "ja");
  assert.equal(lyricLanguage({ plainLyrics: "冷漠的目光彼此对视" }), "zh");
  assert.equal(lyricLanguage({ syncedLyrics: "[ar:한국어 가수]\n[00:10]It's the love shot" }), null);
  assert.equal(lyricLanguage({ plainLyrics: "Despacito, quiero respirar tu cuello despacito" }), null);
  assert.equal(lyricLanguage({}), null);
});

test("Love Shot audio follows Korean lyrics, rejecting foreign and unconfirmed recordings", () => {
  const track = { title: "Love Shot", artist: "EXO", language: "ko" };
  const video = (id: string, title: string, spoken?: string): VideoCandidate => ({ id,
    snippet: { title, channelTitle: "EXO - Topic", defaultAudioLanguage: spoken },
    contentDetails: { duration: "PT3M20S" }, status: { embeddable: true } });
  const wrong = [video("chinese", "Love Shot (Chinese Version)"), video("chi", "Love Shot (Chi ver.)"), video("english", "EXO Love Shot (English Ver.)"),
    video("japanese", "Love Shot (Japanese)"), video("unknown", "Love Shot"),
    video("conflict", "Love Shot (Korean Version)", "zh-CN")];
  assert.equal(chooseAudioVideo(wrong, 200, track), null);
  assert.equal(chooseAudioVideo([...wrong, video("korean", "EXO Love Shot (Korean Ver.)")], 200, track), "korean");
  assert.equal(chooseAudioVideo([...wrong, video("original", "Love Shot", "ko-KR")], 200, track), "original");
  assert.equal(chooseAudioVideo([video("subs", "Love Shot [English Subtitles]", "ko")], 200, track), "subs");
  assert.equal(chooseAudioVideo([video("translation", "Love Shot (Korean Lyrics)")], 200, track), null);
  assert.equal(chooseAudioVideo([video("wrong-artist", "Love Shot (Korean Version)")], 200, { ...track, artist: "Someone Else" }), null);
  assert.equal(chooseAudioVideo([video("wrong-length", "Love Shot (Korean Version)")], 240, track), null);
});

test("explicit versions remain selectable and lyric language wins over catalog version labels", () => {
  const video = (id: string, title: string): VideoCandidate => ({ id, snippet: { title, channelTitle: "EXO - Topic" },
    contentDetails: { duration: "PT3M20S" }, status: { embeddable: true } });
  const videos = [video("zh", "Love Shot (Chinese Version)"), video("en", "Love Shot (English Version)"), video("ko", "Love Shot (Korean Version)")];
  assert.equal(chooseAudioVideo(videos, 200, { title: "Love Shot", artist: "EXO", language: "zh" }), "zh");
  assert.equal(chooseAudioVideo(videos, 200, { title: "Love Shot - English Version", artist: "EXO" }), "en");
  assert.equal(chooseAudioVideo(videos, 200, { title: "Love Shot (Chinese Version)", artist: "EXO", language: "ko" }), "ko");
  assert.equal(chooseAudioVideo(videos, 200, { title: "Love Shot (Live)", artist: "EXO", language: "ko" }), null);
});

test("both YouTube search paths carry the lyric language and reject wrong-language results", async (t) => {
  const previousKey = process.env.YOUTUBE_API_KEY;
  t.after(() => { if (previousKey === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = previousKey; });
  process.env.YOUTUBE_API_KEY = "test-key";
  const queries: string[] = [];
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.hostname === "music.youtube.com") return Response.json({});
    if (url.pathname.endsWith("/search")) {
      queries.push(url.searchParams.get("q")!);
      return Response.json({ items: [{ id: { videoId: "wrong" } }] });
    }
    if (url.pathname.endsWith("/videos")) return Response.json({ items: [{ id: "wrong", snippet: { title: "Love Shot (Chinese Version)", channelTitle: "EXO - Topic" }, contentDetails: { duration: "PT200S" }, status: { embeddable: true } }] });
    queries.push(url.searchParams.get("search_query")!);
    return new Response(`var ytInitialData = ${JSON.stringify({ videoRenderer: { videoId: "correct", title: { simpleText: "EXO Love Shot (Korean Version)" }, ownerText: { simpleText: "EXO - Topic" }, lengthText: { simpleText: "3:20" } } })};`);
  });
  assert.equal(await findAudioVideo({ title: "Love Shot", artist: "EXO", duration: 200, language: "ko" }), "correct");
  assert.equal(queries.length, 4);
  assert.ok(queries.every((query) => query.includes("Korean version")));
  // One YouTube Music lookup (no official song found), three API searches with details, then one public search.
  assert.equal(fetchMock.mock.callCount(), 8);
});

test("YouTube Music songs match the catalog recording, not covers, karaoke, or other edits", () => {
  const item = (id: string, title: string, subtitle: string) => ({ musicResponsiveListItemRenderer: {
    playlistItemData: { videoId: id },
    flexColumns: [title, subtitle].map((text) => ({ musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text }] } } })),
  } });
  const tracks = musicTracksFromResponse({ contents: [
    item("cover0000aa", "Mr. Brightside", "Sinclair & The Acoustic Room • Mr. Brightside • 3:44"),
    item("karaoke00aa", "Mr. Brightside (Made Popular By The Killers) [Karaoke Version]", "Party Tyme Karaoke • Variety Male Hits 1 • 3:43"),
    item("remaster0aa", "Mr. Brightside (Remastered)", "The Killers • Direct Hits • 3:43"),
    item("original0aa", "Mr. Brightside", "The Killers • Hot Fuss • 3:43"),
    item("live000000a", "Mr. Brightside (Live)", "The Killers • Live • 3:43"),
  ] });
  assert.deepEqual(tracks[3], { id: "original0aa", title: "Mr. Brightside", artist: "The Killers", album: "Hot Fuss", duration: 223 });
  assert.equal(chooseMusicTrack(tracks, { title: "Mr. Brightside", artist: "The Killers", album: "Hot Fuss", duration: 223.97 }), "original0aa");
  assert.equal(chooseMusicTrack(tracks, { title: "Mr. Brightside", artist: "The Killers", album: "Direct Hits", duration: 223.97 }), "remaster0aa");
  assert.equal(chooseMusicTrack(tracks, { title: "Mr. Brightside", artist: "The Killers", duration: 240 }), null);
  const korean = musicTracksFromResponse({ contents: [item("japanese0aa", "Ditto (Japanese ver.)", "NewJeans • Ditto • 3:06"), item("korean000aa", "Ditto", "NewJeans • OMG • 3:06")] });
  assert.equal(chooseMusicTrack(korean, { title: "Ditto", artist: "NewJeans", duration: 186, language: "ko" }), "korean000aa");
  const alias = musicTracksFromResponse({ contents: [item("bolbbalgan4", "사랑에 빠졌을 때 When I Fall in Love", "Bolbbalgan4 • RED PLANET • 3:51")] });
  assert.equal(chooseMusicTrack(alias, { title: "When I Fall In Love", artist: "BOL4", album: "Full Album RED PLANET", duration: 230.5 }), "bolbbalgan4");
  assert.equal(chooseMusicTrack(alias, { title: "When I Fall In Love", artist: "BOL4", album: "Another Album", duration: 230.5 }), null);
  assert.equal(chooseMusicTrack(tracks.slice(0, 1), { title: "Mr. Brightside", artist: "The Killers", album: "Hot Fuss", duration: 223.97 }), null);
  assert.equal(isBackingTrack("Mr. Brightside"), false);
  assert.equal(isBackingTrack("사랑하지 않아서 그랬어 (MR)"), true);
});

test("catalog names compare featured artists, collaborators, and remaster labels loosely", () => {
  assert.equal(baseTitle("Bye Bye (feat. Lee Mujin)"), "Bye Bye");
  assert.equal(baseTitle("Hey Jude - Remastered 2015"), "Hey Jude");
  assert.equal(baseTitle("Golden feat. EJAE, AUDREY NUNA"), "Golden");
  assert.equal(baseTitle("Love Story (Taylor’s Version)"), "Love Story (Taylor’s Version)");
  assert.equal(titleMatch("STAY", "STAY (with Justin Bieber) - The Kid LAROI, Justin Bieber"), "partial");
  assert.equal(titleMatch("Love Story (Taylor’s Version)", "Love Story"), "partial");
  assert.equal(titleMatch("Flowers", "Roses"), null);
  assert.ok(sameArtist("HUNTR/X, EJAE, AUDREY NUNA, REI AMI & KPop Demon Hunters Cast", "HUNTR/X"));
  assert.ok(sameArtist("Lady Gaga & Bruno Mars", "Bruno Mars"));
  assert.ok(!sameArtist("IU", "Liquid"));
  assert.ok(sameArtist("Jaehyun Lim", "Lim Jae Hyun"));
  assert.ok(!sameArtist("Jaehyun Lim", "Hickee"));
  assert.equal(primaryArtist("The Kid LAROI & Justin Bieber"), "The Kid LAROI");
});

test("LRCLIB entries rank synced, same-length recordings above plain or different edits", () => {
  const lrc = Array.from({ length: 12 }, (_, i) => `[0${Math.floor(i * 15 / 60)}:${String(i * 15 % 60).padStart(2, "0")}.00]Line ${i}`).join("\n");
  const entry = (trackName: string, artistName: string, duration: number, synced = true) => ({ trackName, artistName, duration, instrumental: false,
    syncedLyrics: synced ? lrc : null, plainLyrics: Array.from({ length: 12 }, (_, i) => `Line ${i}`).join("\n") });
  const track = { title: "Die With A Smile", artist: "Lady Gaga & Bruno Mars", album: "Die With A Smile", duration: 252 };
  const ranked = rankLyricEntries([
    entry("Die With A Smile", "Lady Gaga", 252, false),
    entry("Die With A Smile (Live)", "Lady Gaga", 290),
    entry("Lady Gaga, Bruno Mars - Die With A Smile", "Lady Gaga", 253),
    entry("Die With A Smile", "Cover Band", 260),
  ], track);
  assert.deepEqual(ranked.map((item) => item.duration), [253, 252]);
  assert.equal(rankLyricEntries([entry("Different Song", "Lady Gaga", 252)], track).length, 0);
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
