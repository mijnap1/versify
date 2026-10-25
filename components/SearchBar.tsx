"use client";

import { memo, useEffect, useRef, useState } from "react";
import { ArrowUpLeft, LoaderCircle, Search, X } from "lucide-react";
import { textLang } from "@/lib/lyrics";
import type { Track } from "@/lib/tracks";

export const SearchBar = memo(function SearchBar({ onSelect }: { onSelect: (track: Track) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const visible = open && !!query.trim();

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  useEffect(() => {
    setActive(-1);
    if (!query.trim()) { setTracks([]); setLoading(false); setError(""); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setTracks([]);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setTracks(data.tracks);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Search couldn't be completed.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => {
    if (visible && active >= 0) root.current?.querySelector(`#track-result-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, visible]);

  function select(track: Track) {
    onSelect(track); setOpen(false); setQuery(""); input.current?.blur();
  }

  return <div className="search-root" ref={root}>
    <div className={`search-field ${visible ? "is-open" : ""}`}>
      <Search size={17} strokeWidth={1.6} />
      <input ref={input} aria-label="Search songs or artists" placeholder="Find a song..." value={query}
        role="combobox" aria-expanded={visible} aria-controls={visible ? "track-results" : undefined} aria-autocomplete="list"
        aria-activedescendant={visible && active >= 0 ? `track-result-${active}` : undefined}
        onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); input.current?.blur(); }
          if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((value) => Math.min(value + 1, tracks.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(-1, value - 1)); }
          if (event.key === "Enter" && tracks[active]) { event.preventDefault(); select(tracks[active]); }
        }} />
      {loading ? <LoaderCircle size={16} className="animate-spin" /> : query &&
        <button className="icon-button small" aria-label="Clear search" title="Clear search" onClick={() => { setQuery(""); input.current?.focus(); }}><X size={15} /></button>}
    </div>
    {visible && <div className="search-popover">
      {error && <p className="search-message" role="alert">{error}</p>}
      {loading && <p className="search-message" role="status">Searching...</p>}
      {!loading && !error && tracks.length === 0 && <p className="search-message">No songs found. Try another title or artist.</p>}
      <ul id="track-results" role="listbox" aria-label="Songs">
        {tracks.map((track, index) => <li key={track.id} id={`track-result-${index}`} role="option" aria-selected={index === active}>
          <button className={`search-result ${index === active ? "highlighted" : ""}`} onClick={() => select(track)} onMouseEnter={() => setActive(index)}>
            {track.artwork ? <img src={track.artwork} alt="" width={42} height={42} /> : <span className="result-artwork-placeholder" />}
            <span className="result-copy" lang={textLang(`${track.title} ${track.artist}`)}><strong>{track.title}</strong><span>{track.artist}</span></span>
            <ArrowUpLeft size={16} />
          </button>
        </li>)}
      </ul>
    </div>}
  </div>;
});
