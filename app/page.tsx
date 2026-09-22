"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, ExternalLink, Heart, Link2, X } from "lucide-react";
import { MoreActions } from "@/components/MoreActions";
import { SettingsPanel } from "@/components/SettingsPanel";
import { LibraryPanel } from "@/components/LibraryPanel";
import { isSavedTrack, readPlaylists, startPlaylist, nextPlaylistEntries, syncPlaylistQueue, nextRepeatMode, type RepeatMode, type Playlist, type PlaylistQueue } from "@/lib/playlists";
import { defaultSettings, readSettings, languages, type Settings } from "@/lib/settings";
import { Clock } from "@/components/Clock";
import { SearchBar } from "@/components/SearchBar";
import { LyricViewer } from "@/components/LyricViewer";
import { PlayerControls } from "@/components/PlayerControls";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { activeLyricIndex, parseLrc, youtubeId, type LyricLine } from "@/lib/lyrics";
import { artworkPalette, defaultPalette, type WallpaperPalette } from "@/lib/artwork";
import { featuredTracks, type Track } from "@/lib/tracks";
import { rememberSong, type PlayedSong } from "@/lib/playback-history";
import { correctedVideoId } from "@/lib/video-match";

type LyricsState = { lines: LyricLine[]; plain: string | null; instrumental: boolean; loading: boolean; error: string | null };
type NextSong = { track: Track; lyrics?: { syncedLyrics: string; plainLyrics: string | null } };
const emptyLyrics: LyricsState = { lines: [], plain: null, instrumental: false, loading: true, error: null };

export default function Home() {
  const [settings, setSettings] = useState(defaultSettings);
  const [settingsError, setSettingsError] = useState("");
  const [activePanel, setActivePanel] = useState<"lyrics" | "favorites" | "settings">("lyrics");
  const panelRef = useRef<HTMLElement>(null);
  function closePanel() {
    setActivePanel("lyrics");
    document.querySelector<HTMLButtonElement>(".more-trigger")?.focus({ preventScroll: true });
  }
  useEffect(() => {
    panelRef.current?.querySelectorAll("details").forEach((element) => { element.open = false; });
    if (activePanel !== "lyrics") panelRef.current?.querySelector<HTMLElement>(".panel-view.is-active h2")?.focus({ preventScroll: true });
  }, [activePanel]);
  useEffect(() => {
    try { setSettings(readSettings(JSON.parse(localStorage.getItem("verse-settings") || "{}"))); }
    catch { setSettingsError("Settings could not be restored."); }
  }, []);
  function updateSettings(next: Settings) {
    setSettings(next);
    try { localStorage.setItem("verse-settings", JSON.stringify(next)); setSettingsError(""); }
    catch { setSettingsError("Settings will apply for this visit only."); }
  }
  const [translating, setTranslating] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [loadingDismissed, setLoadingDismissed] = useState(false);
  const [track, setTrack] = useState<Track>(featuredTracks[0]);
  const [videoId, setVideoId] = useState<string | null>(featuredTracks[0].videoId!);
  const [started, setStarted] = useState(false);
  const [lyrics, setLyrics] = useState<LyricsState>(emptyLyrics);
  const [retry, setRetry] = useState(0);
  const [playbackVersion, setPlaybackVersion] = useState(0);
  const [queue, setQueue] = useState<PlaylistQueue | null>(null);
  const [nextSong, setNextSong] = useState<{ version: number; queue: PlaylistQueue | null; repeat: boolean; data?: NextSong; queueIndex?: number; failed?: string[]; error?: string } | null>(null);
  const consumedNext = useRef<number | null>(null);
  const recentSongs = useRef<PlayedSong[]>([]);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const repeat = repeatMode === "playlist" && !!queue;
  const repeatSong = repeatMode === "song" || (repeatMode === "playlist" && !queue);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistError, setPlaylistError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [offset, setOffset] = useState(0);
  const [palette, setPalette] = useState<WallpaperPalette>(defaultPalette);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [matching, setMatching] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const linkDialog = useRef<HTMLDialogElement>(null);
  const artworkRef = useRef<HTMLImageElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const videoRequest = useRef<AbortController | null>(null);
  const starterLyrics = useRef<{ id: string; data: LyricsState } | null>(null);
  const player = useYouTubePlayer(started ? videoId : null, playbackVersion);
  const isFavorite = favorites.some((saved) => saved.id === track.id);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/starter", { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (controller.signal.aborted) return;
      starterLyrics.current = { id: data.track.id, data: { lines: parseLrc(data.lyrics.syncedLyrics), plain: data.lyrics.plainLyrics, instrumental: false, loading: false, error: null } };
      setTrack(data.track); setVideoId(data.track.videoId ?? null);
    }).catch(() => {
      if (!controller.signal.aborted) starterLyrics.current = { id: featuredTracks[0].id, data: { ...emptyLyrics, loading: false, error: "Lyrics services are unavailable. Try again or search for a song." } };
    }).finally(() => { if (!controller.signal.aborted) setInitialized(true); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("verse-favorites") || "[]");
      if (Array.isArray(saved)) setFavorites(saved.filter(isSavedTrack));
    } catch { setStorageError("Saved songs could not be loaded in this browser."); }
    try { setPlaylists(readPlaylists(JSON.parse(localStorage.getItem("verse-playlists") || "[]"))); }
    catch { setPlaylistError("Playlists could not be loaded in this browser."); }
  }, []);

  function updatePlaylists(next: Playlist[]) {
    setPlaylists(next);
    setQueue((current) => current?.id === "favorites" ? current : syncPlaylistQueue(current, next.find((item) => item.id === current?.id)));
    try { localStorage.setItem("verse-playlists", JSON.stringify(next)); setPlaylistError(""); }
    catch { setPlaylistError("Playlists are available for this session only. Browser storage is unavailable."); }
  }

  const toggleFavorite = useCallback((song: Track) => {
    const next = favorites.some((saved) => saved.id === song.id) ? favorites.filter((saved) => saved.id !== song.id) : [song, ...favorites];
    setFavorites(next);
    setQueue((current) => current?.id === "favorites" ? syncPlaylistQueue(current, { id: "favorites", name: "Favorites", tracks: next }) : current);
    try { localStorage.setItem("verse-favorites", JSON.stringify(next)); setStorageError(""); }
    catch { setStorageError("Favorites are available for this session only. Browser storage is unavailable."); }
  }, [favorites]);

  useEffect(() => {
    const image = artworkRef.current;
    if (image?.complete && image.naturalWidth) colorFromArtwork(image);
    if (!track.artwork) setPalette(artworkPalette(new Uint8ClampedArray()));
  }, [track.artwork]);

  useEffect(() => {
    if (!initialized) return;
    if (starterLyrics.current?.id === track.id && retry === 0) {
      setLyrics(starterLyrics.current.data);
      return;
    }
    const controller = new AbortController();
    setLyrics(emptyLyrics);
    const params = new URLSearchParams({ title: track.title, artist: track.artist, album: track.album, duration: String(track.duration) });
    fetch(`/api/lyrics?${params}`, { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!controller.signal.aborted) setLyrics({
        lines: data.syncedLyrics ? parseLrc(data.syncedLyrics) : [],
        plain: data.plainLyrics, instrumental: data.instrumental, loading: false, error: null,
      });
    }).catch((error: Error) => {
      if (!controller.signal.aborted) setLyrics({ ...emptyLyrics, loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [track, retry, initialized]);

  useEffect(() => {
    if (!initialized) return;
    if (track.videoId) { setVideoId(track.videoId); setMatching(false); setMatchingError(null); return; }
    const controller = new AbortController();
    videoRequest.current = controller;
    setMatching(true); setMatchingError(null);
    fetch(`/api/video?${new URLSearchParams({ title: track.title, artist: track.artist, duration: String(track.duration) })}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Audio matching is unavailable."); return response.json(); })
      .then((data) => { if (!controller.signal.aborted) { setVideoId(data.videoId ?? null); setMatchingError(data.error ?? null); } })
      .catch((error: Error) => { if (!controller.signal.aborted) setMatchingError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setMatching(false); });
    return () => controller.abort();
  }, [track, initialized]);

  useEffect(() => {
    if (player.ready && pendingSeek.current !== null) {
      player.seek(pendingSeek.current); pendingSeek.current = null;
    }
  }, [player.ready]);

  useEffect(() => {
    if (linkOpen) linkDialog.current?.showModal();
    else linkDialog.current?.close();
  }, [linkOpen]);

  const selectTrack = useCallback((next: Track, playlistQueue: PlaylistQueue | null = null) => {
    next = { ...next, videoId: correctedVideoId(next.videoId, next) };
    starterLyrics.current = null;
    videoRequest.current?.abort();
    setStarted(true); setVideoId(next.videoId ?? null); setMatching(!next.videoId); pendingSeek.current = null;
    setTrack(next); setOffset(0); setLinkOpen(false); setMatchingError(null);
    setArtworkFailed(false); setLink(""); setLinkError("");
    setQueue(playlistQueue); setPlaybackVersion((value) => value + 1);
  }, []);

  function playPlaylist(playlist: Playlist, shuffle = false, startId?: string) {
    const next = startPlaylist(playlist, shuffle, startId);
    if (!next.tracks.length) return;
    selectTrack(next.tracks[next.index], next);
    closePanel();
  }

  useEffect(() => {
    if (!initialized || !started || (repeatSong && !queue)) return;
    const controller = new AbortController();
    setNextSong(null);
    recentSongs.current = rememberSong(recentSongs.current, track);
    const context = { version: playbackVersion, queue, repeat };
    async function prepareNext() {
      if (queue) {
        const failed = [...queue.failed];
        for (const entry of nextPlaylistEntries(queue, repeat)) {
          controller.signal.throwIfAborted();
          const song = { ...entry.track, videoId: correctedVideoId(entry.track.videoId, entry.track) };
          try {
            if (!song.videoId) {
              const response = await fetch(`/api/video?${new URLSearchParams({ title: song.title, artist: song.artist, duration: String(song.duration) })}`,
                { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
              if (!response.ok) throw new Error("Audio unavailable");
              song.videoId = (await response.json()).videoId;
            }
            if (!song.videoId) throw new Error("Audio unavailable");
          } catch { controller.signal.throwIfAborted(); failed.push(song.id); continue; }
          const params = new URLSearchParams({ title: song.title, artist: song.artist, album: song.album, duration: String(song.duration) });
          const lyrics = await fetch(`/api/lyrics?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]) })
            .then((response) => response.ok ? response.json() : undefined).catch(() => undefined);
          if (!controller.signal.aborted) setNextSong({ ...context, data: { track: song, lyrics }, queueIndex: entry.index, failed });
          return;
        }
        if (repeat) throw new Error("No playable songs left in this playlist. Try another playlist or turn off loop.");
      }
      const response = await fetch("/api/next", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist: track.artist, title: track.title, exclude: track.id, recent: recentSongs.current }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setNextSong({ ...context, data });
    }
    prepareNext().catch((error: Error) => { if (!controller.signal.aborted) setNextSong({ ...context, error: error.message }); });
    return () => controller.abort();
  }, [initialized, started, repeat, repeatSong, track.id, track.artist, track.title, queue, playbackVersion]);

  useEffect(() => {
    if (queue && (player.error || (!matching && matchingError && !videoId)) && !queue.failed.includes(track.id)) setQueue({ ...queue, failed: [...queue.failed, track.id] });
  }, [player.error, queue, track.id, matching, matchingError, videoId]);

  const advanceSong = useCallback(() => {
    if (nextSong?.version !== playbackVersion || nextSong.queue !== queue || nextSong.repeat !== repeat || consumedNext.current === playbackVersion) return;
    if (nextSong.error) { setMatchingError(nextSong.error); return; }
    if (!nextSong.data) return;
    consumedNext.current = playbackVersion;
    const data = nextSong.data;
    selectTrack(data.track, queue && nextSong.queueIndex !== undefined ? { ...queue, index: nextSong.queueIndex, failed: nextSong.failed ?? queue.failed } : null);
    if (data.lyrics) starterLyrics.current = { id: data.track.id, data: { lines: parseLrc(data.lyrics.syncedLyrics || ""), plain: data.lyrics.plainLyrics, instrumental: false, loading: false, error: null } };
  }, [nextSong, playbackVersion, queue, repeat, selectTrack]);

  useEffect(() => {
    if (!player.ended && !(queue && (player.error || (!matching && matchingError && !videoId)))) return;
    if (player.ended && repeatSong) { player.seek(0); player.toggle(); return; }
    advanceSong();
  }, [player.ended, player.error, repeatSong, player.seek, player.toggle, queue, matching, matchingError, videoId, advanceSong]);

  const playPause = useCallback(() => {
    if (!videoId) { setLinkOpen(true); return; }
    if (!started) setStarted(true);
    else if (player.error && !player.ready) setStarted(false);
    else player.toggle();
  }, [videoId, started, player.error, player.ready, player.toggle]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (event.code !== "Space" || !initialized || event.altKey || event.ctrlKey || event.metaKey || (target instanceof HTMLElement && target.closest("input, textarea, select, summary, [contenteditable]:not([contenteditable='false']), dialog[open]"))) return;
      event.preventDefault();
      if (event.repeat) return;
      playPause();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [playPause, initialized]);

  const seek = useCallback((time: number) => {
    if (!videoId) { setLinkOpen(true); return; }
    if (!player.ready) { pendingSeek.current = time; setStarted(true); }
    else player.seek(time);
  }, [videoId, player.ready, player.seek]);

  const retryLyrics = useCallback(() => setRetry((value) => value + 1), []);
  const toggleRepeat = useCallback(() => setRepeatMode((value) => nextRepeatMode(value, !!queue)), [queue]);
  useEffect(() => {
    const syncFullscreen = () => setFullscreen(!!document.fullscreenElement);
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  const toggleFullscreen = useCallback(async () => {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { setFullscreenError("Fullscreen is unavailable in this browser."); }
  }, []);
  const saveCurrent = useCallback(() => toggleFavorite({ ...track, videoId: videoId ?? undefined }), [toggleFavorite, track, videoId]);

  function colorFromArtwork(image: HTMLImageElement) {
    const canvas = document.createElement("canvas");
    canvas.width = 32; canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    try {
      context.drawImage(image, 0, 0, 32, 32);
      setPalette(artworkPalette(context.getImageData(0, 0, 32, 32).data));
    } catch { setPalette(defaultPalette); }
  }

  return <>
    {!loadingDismissed && <div className={`starter-loading ${initialized ? "is-leaving" : ""}`} role="status" aria-hidden={initialized}
      onTransitionEnd={(event) => { if (initialized && event.target === event.currentTarget && event.propertyName === "opacity") setLoadingDismissed(true); }}>
    <span className="starter-spinner" aria-hidden="true" />
    <span>Finding your first song...</span>
    </div>}

  {initialized && <div className="app-shell" style={{ "--lyric-scale": settings.lyricScale } as CSSProperties}>
    <div className="wallpaper" aria-hidden="true" style={{
      "--wallpaper-start": palette[0], "--wallpaper-middle": palette[1], "--wallpaper-end": palette[2],
    } as CSSProperties} />

    <header className="search-position"><Clock hour12={settings.hour12} /><SearchBar onSelect={selectTrack} />
      <MoreActions onSettings={() => setActivePanel("settings")} languageName={languages[settings.language]} onFavorites={() => setActivePanel("favorites")} translating={translating} onTranslate={() => setTranslating((value) => !value)} />
    </header>

    <main className="listening-room">
      <section className="album-panel" aria-label="Current song">
        <div className={`record-scene ${player.playing ? "is-playing" : ""}`}>
          <div className="vinyl" aria-hidden="true">
            <img src="/vinyl.png" alt="" width={2000} height={2000} draggable={false} />
          </div>
          <div className="sleeve" key={track.id}>
            {track.artwork && !artworkFailed ?
              <img ref={artworkRef} className="album-artwork" src={track.artwork} alt={`${track.album} album cover`} width={640} height={640} draggable={false}
                onLoad={(event) => colorFromArtwork(event.currentTarget)} onError={() => { setArtworkFailed(true); setPalette(artworkPalette(new Uint8ClampedArray())); }} /> :
              <div className="artwork-fallback" role="img" aria-label="Album artwork unavailable"><span>{track.title}</span></div>}
          </div>
        </div>
        <div className="track-info" key={`info-${track.id}`}>
          <h1>{track.title}</h1>
          <div className="artist-row">
            <p>{track.artist}</p>
          </div>
        </div>
        {(player.error || matchingError) && <div className="audio-notice" role="alert">
          <p>{player.error || matchingError}</p>
          <button onClick={() => setLinkOpen(true)}>Change source <ArrowRight size={13} /></button>
          {player.error && <button onClick={() => setStarted(false)}>Reset player</button>}
        </div>}
      </section>

      <section ref={panelRef} className="lyrics-panel" aria-label="Lyrics and library"
        onKeyDown={(event) => { if (event.key === "Escape" && activePanel !== "lyrics" && !event.defaultPrevented) { event.stopPropagation(); closePanel(); } }}>
        <div className={`panel-view lyrics-view ${activePanel === "lyrics" ? "is-active" : ""}`} inert={activePanel !== "lyrics"} aria-hidden={activePanel !== "lyrics"}>
          <LyricViewer lines={lyrics.lines} plainLyrics={lyrics.plain} active={activeLyricIndex(lyrics.lines, player.currentTime + offset)} offset={offset}
          loading={lyrics.loading} error={lyrics.error} instrumental={lyrics.instrumental} onSeek={seek}
          onRetry={retryLyrics} canSeek={!matching} fullscreen={fullscreen} translating={translating} language={settings.language} lyricScale={settings.lyricScale} />
        </div>
        {(["favorites", "settings"] as const).map((panel) => <div key={panel}
          className={`panel-view library-view ${activePanel === panel ? "is-active" : ""}`}
          inert={activePanel !== panel} aria-hidden={activePanel !== panel} aria-labelledby={`${panel}-title`} role="region">
          <div className="panel-heading"><h2 id={`${panel}-title`} tabIndex={-1}>{panel === "favorites" ? "Library" : "Settings"}</h2>
            <button className="icon-button" aria-label={`Close ${panel === "favorites" ? "library" : panel}`} onClick={closePanel}><X size={19} /></button>
          </div>
          <div className="panel-content">
            {panel === "settings" ? <SettingsPanel settings={settings} onChange={updateSettings} error={settingsError} /> : <>
              {storageError && <p role="alert">{storageError}</p>}
              {playlistError && <p role="alert">{playlistError}</p>}
              <LibraryPanel playlists={playlists} favorites={favorites} current={{ ...track, videoId: videoId ?? undefined }}
                playingId={started ? track.id : undefined} playing={player.playing && activePanel === "favorites"} selected={selectedPlaylist} onSelect={setSelectedPlaylist}
                onChange={updatePlaylists} onFavorite={toggleFavorite} onPlay={playPlaylist} />
            </>}
          </div>
        </div>)}
      </section>
    </main>

    <PlayerControls playing={player.playing} buffering={player.buffering || matching} currentTime={player.currentTime}
      duration={player.duration || track.duration} volume={player.volume} repeat={repeatSong ? "song" : repeat ? "playlist" : "off"} canSeek={!!videoId && !matching}
      onPlayPause={playPause} onSeek={seek} onVolume={player.setVolume} onRepeat={toggleRepeat}
      favorite={isFavorite} onFavorite={saveCurrent}
      fullscreen={fullscreen} onFullscreen={toggleFullscreen}
      playlistName={queue?.name} onOpenPlaylist={() => { setSelectedPlaylist(queue?.id ?? null); setActivePanel("favorites"); }}
      onNext={advanceSong} canNext={nextSong?.version === playbackVersion && nextSong.queue === queue && nextSong.repeat === repeat && !!nextSong.data} />
    {fullscreenError && <p className="audio-notice" role="alert">{fullscreenError}</p>}

    <footer className="site-credit"><small>&copy; 2026 Jamie Ryu</small></footer>

    <div ref={player.containerRef} className="audio-engine" aria-hidden="true" inert />

    <dialog ref={linkDialog} className="source-dialog" aria-labelledby="source-dialog-title" onCancel={() => setLinkOpen(false)}
      onClick={(event) => { if (event.target === event.currentTarget) setLinkOpen(false); }}>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!link.trim() && videoId) { setLinkOpen(false); return; }
        const id = youtubeId(link);
        if (!id) { setLinkError("Enter a valid YouTube video URL or video ID."); return; }
        videoRequest.current?.abort(); setMatching(false); setStarted(false); setVideoId(id);
        setMatchingError(null); setLinkOpen(false); setLink(""); setLinkError("");
      }}>
        <div className="dialog-heading"><Link2 size={21} /><button type="button" className="icon-button" aria-label="Close audio dialog" onClick={() => setLinkOpen(false)}><X size={19} /></button></div>
        <h2 id="source-dialog-title">{videoId ? "Your version." : "Connect the music."}</h2>
        <p>Choose a YouTube recording of {track.title} by {track.artist}.</p>
        <label htmlFor="youtube-url">YouTube link</label>
        <input id="youtube-url" placeholder="https://www.youtube.com/watch?v=..." value={link}
          onChange={(event) => { setLink(event.target.value); setLinkError(""); }} autoComplete="off" autoFocus />
        {linkError && <p className="form-error" role="alert">{linkError}</p>}
        <div className="timing-setting"><label htmlFor="lyric-offset">Lyric timing (seconds)</label>
          <input id="lyric-offset" type="number" min={-30} max={30} step={0.5} value={offset}
            onChange={(event) => setOffset(Math.max(-30, Math.min(30, Number(event.target.value) || 0)))} /></div>
        <button type="submit" className="primary-button">{videoId && !link.trim() ? "Done" : "Connect audio"} <ArrowRight size={16} /></button>
        <a className="find-on-youtube" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${track.artist} ${track.title} official audio`)}`} target="_blank" rel="noreferrer">Find on YouTube <ExternalLink size={13} /></a>
      </form>
    </dialog>
  </div>}
  </>;
}
