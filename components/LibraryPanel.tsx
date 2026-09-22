"use client";

import { ArrowLeft, Check, ChevronRight, Heart, ListMusic, Pencil, Play, Plus, Shuffle, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { uniqueTracks, type Playlist } from "@/lib/playlists";
import type { Track } from "@/lib/tracks";

type Props = {
  playlists: Playlist[]; favorites: Track[]; current: Track; playingId?: string; playing: boolean;
  selected: string | null; onSelect: (id: string | null) => void;
  onChange: (playlists: Playlist[]) => void; onFavorite: (track: Track) => void;
  onPlay: (playlist: Playlist, shuffle?: boolean, startId?: string) => void;
};

export function LibraryPanel({ playlists, favorites, current, playingId, playing, selected, onSelect, onChange, onFavorite, onPlay }: Props) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update(); document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const [editing, setEditing] = useState<"create" | "rename" | null>(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState<Track | null>(null);
  const [notice, setNotice] = useState("");
  const [deleted, setDeleted] = useState<Playlist | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const collections: Playlist[] = [{ id: "favorites", name: "Favorites", tracks: favorites }, ...playlists];
  const playlist = collections.find((item) => item.id === selected);
  useEffect(() => { setEditing(null); setNotice(""); heading.current?.focus({ preventScroll: true }); }, [selected]);

  function addTo(target: Playlist, song: Track) {
    if (target.id === "favorites") { if (!favorites.some((item) => item.id === song.id)) onFavorite(song); }
    else onChange(playlists.map((item) => item.id === target.id ? { ...item, tracks: uniqueTracks([...item.tracks, song]) } : item));
    setAdding(null); setNotice(`Added to ${target.name}`);
  }

  return <div className="playlist-panel">
    {editing === "create" ? <form className="playlist-name-form" onSubmit={(event) => {
      event.preventDefault(); if (!name.trim()) return;
      const item = { id: crypto.randomUUID(), name: name.trim(), tracks: adding ? [adding] : [] }; onChange([...playlists, item]); setAdding(null); onSelect(item.id);
      setEditing(null);
    }}>
      <div className="playlist-create-heading"><h3>New playlist</h3>
        <button className="icon-button" type="button" aria-label="Cancel playlist name" onClick={() => setEditing(null)}><X size={16} /></button>
      </div>
      <input autoFocus aria-label="Playlist name" placeholder="Playlist name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setEditing(null); } }} />
      <button className="library-pill" type="submit" disabled={!name.trim()}><Plus size={15} /> Create playlist</button>
    </form> : playlist && !adding ? <>
      <div className="playlist-navigation"><button className="text-button" onClick={() => onSelect(null)}><ArrowLeft size={15} /> Library</button>
        {playlist.id !== "favorites" && <div className="playlist-edit-actions">
          <button className="icon-button" aria-label="Rename playlist" onClick={() => { setName(playlist.name); setEditing("rename"); }}><Pencil size={15} /></button>
          <button className="icon-button" aria-label="Delete playlist" onClick={() => { setDeleted(playlist); onChange(playlists.filter((item) => item.id !== playlist.id)); onSelect(null); }}><Trash2 size={15} /></button>
        </div>}
      </div>
      {editing === "rename" ? <form className="playlist-title-editor" onSubmit={(event) => {
        event.preventDefault(); if (!name.trim()) return;
        onChange(playlists.map((item) => item.id === playlist.id ? { ...item, name: name.trim() } : item));
        setEditing(null);
      }}>
        <input autoFocus aria-label="Playlist name" maxLength={60} value={name} onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setEditing(null); } }} />
        <button className="icon-button" type="submit" aria-label="Save playlist name" disabled={!name.trim()}><Check size={17} /></button>
        <button className="icon-button" type="button" aria-label="Cancel rename" onClick={() => setEditing(null)}><X size={17} /></button>
      </form> : <h3 ref={heading} tabIndex={-1} className="playlist-title">{playlist.name}</h3>}
      <div className="playlist-toolbar">
        <button className="library-pill" disabled={!playlist.tracks.length} onClick={() => onPlay(playlist)}><Play size={14} fill="currentColor" /> Play</button>
        <button className="library-pill" disabled={!playlist.tracks.length} onClick={() => onPlay(playlist, true)}><Shuffle size={15} /> Shuffle</button>
        <span className="playlist-count">{playlist.tracks.length} {playlist.tracks.length === 1 ? "song" : "songs"}</span>
      </div>
      <button className="library-add-current" disabled={playlist.tracks.some((song) => song.id === current.id)} onClick={() => addTo(playlist, current)}>
        {playlist.tracks.some((song) => song.id === current.id) ? <Check size={16} /> : <Plus size={16} />}
        <span>{playlist.tracks.some((song) => song.id === current.id) ? "Current song added" : "Add current song"}<small>{current.title}</small></span>
      </button>
      {!playlist.tracks.length && <p className="panel-empty">Search for a song, then add it here.</p>}
      <ul className="favorites-list">{playlist.tracks.map((song) => <li key={song.id} className={playingId === song.id ? "is-current" : ""}>
        <button className="search-result" aria-current={playingId === song.id ? "true" : undefined} onClick={() => onPlay(playlist, false, song.id)}>
          {song.artwork && <img src={song.artwork} alt="" width={42} height={42} />}
          <span className="result-copy"><strong>{song.title}</strong><span>{song.artist}</span></span>
          {playingId === song.id && <span className={`playing-mark ${playing && visible ? "is-playing" : ""}`} aria-label="Current song"><i /><i /><i /></span>}
        </button>
        <button className="icon-button" aria-label={`Add ${song.title} to another playlist`} onClick={() => { setAdding(song); setNotice(""); }}><Plus size={16} /></button>
        <button className={`icon-button ${playlist.id === "favorites" ? "favorite-button selected" : ""}`} aria-label={`Remove ${song.title} from ${playlist.name}`}
          onClick={() => playlist.id === "favorites" ? onFavorite(song) : onChange(playlists.map((item) => item.id === playlist.id ? { ...item, tracks: item.tracks.filter((track) => track.id !== song.id) } : item))}>
          {playlist.id === "favorites" ? <Heart size={17} fill="currentColor" /> : <X size={16} />}
        </button>
      </li>)}</ul>
    </> : <>
      {adding ? <div className="playlist-navigation"><span className="playlist-add-label">Add “{adding.title}” to…</span><button className="icon-button" aria-label="Cancel adding song" onClick={() => setAdding(null)}><X size={16} /></button></div>
        : <div className="playlist-toolbar"><button className="library-pill" onClick={() => { setName(""); setEditing("create"); }}><Plus size={16} /> New playlist</button>
          <button className="library-pill" onClick={() => { setAdding(current); setNotice(""); }}><Plus size={16} /> Add current song</button></div>}
      <ul className="playlist-collections">{collections.map((item) => <li key={item.id}>
        <button className="playlist-collection" onClick={() => { if (adding) addTo(item, adding); else onSelect(item.id); }}>
          <span className={`playlist-cover ${item.id === "favorites" ? "is-favorites" : ""}`}>
            {item.id === "favorites" ? <Heart size={22} /> : item.tracks[0]?.artwork ? <img src={item.tracks[0].artwork} alt="" /> : <ListMusic size={23} />}
          </span>
          <span className="result-copy"><strong>{item.name}</strong><span>{item.tracks.length} {item.tracks.length === 1 ? "song" : "songs"}</span></span>
          {adding ? item.tracks.some((song) => song.id === adding.id) ? <Check size={17} /> : <Plus size={17} /> : <ChevronRight size={17} />}
        </button>
      </li>)}</ul>
      {adding && <button className="text-button" onClick={() => { setName(""); setEditing("create"); }}><Plus size={15} /> New playlist</button>}
    </>}
    {notice && <p className="library-notice" role="status">{notice}</p>}
    {deleted && <p className="library-notice" role="status">Playlist deleted. <button className="text-button" onClick={() => { onChange([...playlists, deleted]); setDeleted(null); }}>Undo</button></p>}
  </div>;
}
