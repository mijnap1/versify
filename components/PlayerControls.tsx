"use client";

import { Expand, Heart, LoaderCircle, Minimize, Pause, Play, Repeat1, Repeat2, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Glass } from "./Glass";
import { useMemo, useRef, type CSSProperties } from "react";
import { formatTime } from "@/lib/lyrics";
import type { RepeatMode } from "@/lib/playlists";

type Props = {
  playing: boolean; buffering: boolean; currentTime: number; duration: number;
  volume: number; repeat: RepeatMode; canSeek: boolean;
  onPlayPause: () => void; onSeek: (time: number) => void;
  onVolume: (volume: number) => void; onRepeat: () => void;
  favorite: boolean; onFavorite: () => void;
  fullscreen: boolean; onFullscreen: () => void;
  playlistName?: string; onOpenPlaylist: () => void; onNext: () => void; canNext: boolean;
};

export function PlayerControls({ playing, buffering, currentTime, duration, volume, repeat, canSeek, onPlayPause, onSeek, onVolume, onRepeat, favorite, onFavorite, fullscreen, onFullscreen, playlistName, onOpenPlaylist, onNext, canNext }: Props) {
  const previousVolume = useRef(70);
  const progress = duration > 0 ? Math.min(100, currentTime / duration * 100) : 0;

  const transport = useMemo(() => <div className="transport">
      <Glass className="fullscreen-glass"><button className={`icon-button fullscreen-button ${fullscreen ? "selected" : ""}`} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={fullscreen ? "Exit fullscreen" : "Fullscreen"} aria-pressed={fullscreen} onClick={onFullscreen}>
        {fullscreen ? <Minimize size={20} strokeWidth={1.6} /> : <Expand size={20} strokeWidth={1.6} />}
      </button></Glass>
      <Glass className="repeat-glass">
      <button className={`icon-button repeat-button ${repeat !== "off" ? "selected" : ""}`} title={repeat === "off" ? "Loop off" : repeat === "playlist" ? "Loop playlist" : "Loop current song"} aria-label={repeat === "off" ? "Loop off" : repeat === "playlist" ? "Loop playlist" : "Loop current song"} aria-pressed={repeat !== "off"} onClick={onRepeat}>
        {repeat === "song" ? <Repeat1 size={21} strokeWidth={1.6} /> : <Repeat2 size={21} strokeWidth={1.6} />}
      </button></Glass>
      <Glass className="play-glass">
      <button className="play-button" aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause" : "Play"} onClick={onPlayPause} disabled={buffering}>
        {buffering ? <LoaderCircle size={27} className="animate-spin" /> : playing ? <Pause size={27} fill="currentColor" strokeWidth={1.3} /> : <Play size={27} fill="currentColor" strokeWidth={1.3} className="play-glyph" />}
      </button></Glass>
      <div className="volume-control">
        <Glass>
        <button className="icon-button" aria-label={volume === 0 ? "Unmute" : "Mute"} title={volume === 0 ? "Unmute" : "Mute"}
          onClick={() => { if (volume) { previousVolume.current = volume; onVolume(0); } else onVolume(previousVolume.current); }}>
          {volume === 0 ? <VolumeX size={21} strokeWidth={1.6} /> : <Volume2 size={21} strokeWidth={1.6} />}
        </button></Glass>
        <div className="volume-popover"><Glass className="volume-glass"><div className="volume-slider-stage"><input type="range" min={0} max={100} value={volume} aria-label="Volume" aria-orientation="vertical"
          onChange={(event) => onVolume(Number(event.target.value))} style={{ "--range-progress": `${volume}%` } as CSSProperties} /></div></Glass></div>
      </div>
      <Glass className="favorite-glass"><button className={`icon-button favorite-button ${favorite ? "selected" : ""}`} title={favorite ? "Remove from favorites" : "Save to favorites"} aria-label={favorite ? "Remove from favorites" : "Save to favorites"} aria-pressed={favorite} onClick={onFavorite}><Heart size={20} fill={favorite ? "currentColor" : "none"} strokeWidth={1.6} /></button></Glass>
    </div>, [playing, buffering, volume, repeat, favorite, fullscreen, playlistName, onPlayPause, onVolume, onRepeat, onFavorite, onFullscreen]);

  return <div className="player-controls" role="group" aria-label="Playback controls">
    {playlistName && <div className="playlist-source"><button onClick={onOpenPlaylist}>Playing from <strong>{playlistName}</strong></button><button className="icon-button" aria-label="Next song in playlist" title="Next song" onClick={onNext} disabled={!canNext}><SkipForward size={14} /></button></div>}
    {transport}
    <div className="progress-row">
      <time>{formatTime(currentTime)}</time>
      <Glass className="timeline-glass"><input type="range" min={0} max={duration || 1} step={0.1} value={Math.min(currentTime, duration || 1)} disabled={!canSeek}
        aria-label="Playback position" aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        onChange={(event) => onSeek(Number(event.target.value))} style={{ "--range-progress": `${progress}%` } as CSSProperties} /></Glass>
      <time>{formatTime(duration)}</time>
    </div>
  </div>;
}
