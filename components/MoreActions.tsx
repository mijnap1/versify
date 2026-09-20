"use client";

import { useEffect, useRef, useState } from "react";
import { FolderHeart, Languages, MoreHorizontal, Settings2 } from "lucide-react";

export function MoreActions({ onSettings, languageName, onFavorites, translating, onTranslate }: { onSettings: () => void; languageName: string; onFavorites: () => void; translating: boolean; onTranslate: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div ref={root} className={`more-actions ${open ? "is-open" : ""}`}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span className="more-surface" aria-hidden="true" />
    <button ref={trigger} className="icon-button more-trigger" aria-label="More actions" title="More actions"
      aria-expanded={open} aria-controls="extra-actions" onClick={() => setOpen(!open)}><MoreHorizontal size={21} strokeWidth={1.5} /></button>
    <div id="extra-actions" className="more-items" inert={!open} aria-hidden={!open}>
      <button className="icon-button" aria-label="Open settings" title="Settings" onClick={() => { trigger.current?.focus(); setOpen(false); onSettings(); }}><Settings2 size={20} strokeWidth={1.5} /></button>
      <button className="icon-button" aria-label="Open favorites" title="Favorites" onClick={() => { trigger.current?.focus(); setOpen(false); onFavorites(); }}>
        <FolderHeart size={20} strokeWidth={1.5} />
      </button>
      <button className="icon-button" aria-label={`Show ${languageName} translation`} title={`${languageName} translation`} aria-pressed={translating} onClick={onTranslate}><Languages size={20} strokeWidth={1.5} /></button>
    </div>
  </div>;
}
