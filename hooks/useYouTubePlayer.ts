"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window { YT: typeof YT; onYouTubeIframeAPIReady?: () => void }
}

let sdkPromise: Promise<void> | undefined;
function loadSDK() {
  if (window.YT?.Player) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("YouTube took too long to load. Check your connection and retry.")), 15000);
      window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(); };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error("YouTube couldn't be reached. Check your connection.")); };
      document.head.appendChild(script);
    }).catch((error) => { sdkPromise = undefined; throw error; });
  }
  return sdkPromise;
}

export function useYouTubePlayer(videoId: string | null, playbackVersion = 0) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [ended, setEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(70);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState({ videoId, playbackVersion });
  const volumeRef = useRef(volume);

  useEffect(() => {
    setLoaded({ videoId, playbackVersion });
    setReady(false); setPlaying(false); setCurrentTime(0); setDuration(0); setError(null); setEnded(false);
    if (!videoId) { setBuffering(false); return; }
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let readyTimeout: ReturnType<typeof setTimeout> | undefined;
    let player: YT.Player | undefined;
    let playbackActive = false;
    function syncTime() {
      if (cancelled || !playerRef.current) return;
      const time = playerRef.current.getCurrentTime();
      const total = playerRef.current.getDuration();
      if (Number.isFinite(time)) setCurrentTime(time);
      if (Number.isFinite(total) && total > 0) setDuration(total);
    }
    function updatePolling() {
      clearInterval(interval);
      interval = undefined;
      if (!document.hidden) {
        syncTime();
        if (playbackActive) interval = setInterval(syncTime, 200);
      }
    }
    document.addEventListener("visibilitychange", updatePolling);
    setBuffering(true);
    loadSDK().then(() => {
      if (cancelled || !containerRef.current) return;
      const mount = document.createElement("div");
      containerRef.current.replaceChildren(mount);
      readyTimeout = setTimeout(() => {
        if (!cancelled) { setBuffering(false); setError("The video couldn't connect. Reset the player or try another YouTube link."); }
      }, 15000);
      player = new window.YT.Player(mount, {
        width: "100%", height: "100%", videoId,
        playerVars: { controls: 0, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady(event) {
            if (cancelled) return;
            clearTimeout(readyTimeout); setError(null);
            playerRef.current = event.target;
            event.target.getIframe().title = "YouTube music player";
            event.target.setVolume(volumeRef.current);
            setReady(true); setBuffering(false);
            event.target.playVideo();
            updatePolling();
          },
          onStateChange(event) {
            if (cancelled) return;
            setPlaying(event.data === 1);
            setBuffering(event.data === 3);
            setEnded(event.data === 0);
            playbackActive = event.data === 1;
            updatePolling();
            if (event.data === 1) setError(null);
          },
          onError(event) {
            if (cancelled) return;
            clearTimeout(readyTimeout);
            playbackActive = false; updatePolling();
            setPlaying(false); setBuffering(false);
            setError([101, 150].includes(event.data) ? "This video doesn't allow embedded playback. Connect another YouTube link." : "This video can't be played here. Try another YouTube link.");
          },
          onAutoplayBlocked() { if (!cancelled) { setBuffering(false); setPlaying(false); } },
        },
      });
    }).catch((error: Error) => { if (!cancelled) { setError(error.message); setBuffering(false); } });
    return () => { cancelled = true; document.removeEventListener("visibilitychange", updatePolling); clearInterval(interval); clearTimeout(readyTimeout); playerRef.current = null; player?.destroy(); };
  }, [videoId, playbackVersion]);

  const toggle = useCallback(() => {
    if (!ready) return;
    if (playing) playerRef.current?.pauseVideo();
    else playerRef.current?.playVideo();
  }, [ready, playing]);
  const seek = useCallback((time: number) => {
    if (!ready) return;
    const next = Math.max(0, Math.min(time, duration || Infinity));
    playerRef.current?.seekTo(next, true); setCurrentTime(next); setEnded(false);
  }, [ready, duration]);
  const setVolume = useCallback((value: number) => {
    volumeRef.current = value; setVolumeState(value); playerRef.current?.setVolume(value);
  }, []);
  const current = loaded.videoId === videoId && loaded.playbackVersion === playbackVersion;
  return { containerRef, playing: current && playing, ready: current && ready, buffering, ended: current && ended, currentTime, duration, volume, error: current ? error : null, toggle, seek, setVolume };
}
