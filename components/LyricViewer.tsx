"use client";

import { memo, useEffect, useRef, useState } from "react";
import { AudioLines, RotateCcw } from "lucide-react";
import { formatTime, type LyricLine } from "@/lib/lyrics";

type Props = { lines: LyricLine[]; plainLyrics: string | null; active: number; offset: number; loading: boolean; error: string | null; instrumental: boolean; onSeek: (time: number) => void; onRetry: () => void; canSeek: boolean; fullscreen: boolean; translating: boolean };

export const LyricViewer = memo(function LyricViewer({ lines, plainLyrics, active, offset, loading, error, instrumental, onSeek, onRetry, canSeek, fullscreen, translating }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef(0);
  const [following, setFollowing] = useState(true);
  const source = JSON.stringify(lines.length ? lines.map((line) => line.text) : plainLyrics?.split("\n") ?? []);
  const [translated, setTranslated] = useState<{ source: string; lines: string[] } | null>(null);
  const [translationError, setTranslationError] = useState("");
  const translations = translating && translated?.source === source ? translated.lines : null;

  useEffect(() => {
    if (!translating || loading || source === "[]" || translated?.source === source) return;
    const controller = new AbortController();
    setTranslationError("");
    fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: JSON.parse(source) }), signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Translation couldn't be loaded.");
        if (!controller.signal.aborted) setTranslated({ source, lines: data.lines });
      })
      .catch((error: Error) => { if (!controller.signal.aborted) setTranslationError(error.message); });
    return () => controller.abort();
  }, [translating, loading, source, translated]);

  useEffect(() => { setFollowing(true); }, [active, lines]);
  useEffect(() => {
    if (!following || !viewport.current) return;
    const line = viewport.current.querySelector<HTMLElement>(`[data-line="${Math.max(0, active)}"]`);
    if (!line) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const element = viewport.current;
    const start = element.scrollTop;
    const target = Math.max(0, Math.min(element.scrollHeight - element.clientHeight,
      line.offsetTop - element.clientHeight * 0.44 + line.clientHeight / 2));
    if (reducedMotion) { element.scrollTop = target; return; }

    // Ease out from the current position; manual scrolling cancels immediately.
    const started = performance.now();
    function step(now: number) {
      const progress = Math.min(1, (now - started) / 560);
      const eased = 1 - (1 - progress) ** 3;
      element.scrollTop = start + (target - start) * eased;
      if (progress < 1) scrollFrame.current = requestAnimationFrame(step);
    }
    scrollFrame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(scrollFrame.current);
  }, [active, following, lines, fullscreen, translations, translating]);

  function stopFollowing() {
    cancelAnimationFrame(scrollFrame.current); setFollowing(false);
  }

  if (loading) return <div className="lyric-empty" aria-busy="true" aria-label="Loading lyrics"><div className="lyric-skeleton"><i /><i /><i /><i /></div></div>;
  if (error) return <div className="lyric-empty"><AudioLines size={30} /><h2>The words are a little out of reach.</h2><p>{error}</p><button className="text-button" onClick={onRetry}><RotateCcw size={15} /> Try again</button></div>;
  if (!lines.length && !plainLyrics) return <div className="lyric-empty"><AudioLines size={34} /><h2>{instrumental ? "Some things need no words." : "Just you and the music."}</h2><p>{instrumental ? "An instrumental moment." : "Lyrics aren't available for this song yet."}</p></div>;

  return <div className="lyric-viewer">
    {translating && !loading && !translations && <p className="translation-status" role="status">{translationError || "Translating to Korean…"}</p>}
    <div className="lyric-scroll" ref={viewport} onWheel={stopFollowing} onTouchStart={stopFollowing} onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) stopFollowing(); }} tabIndex={0} aria-label="Song lyrics">
      <div className="lyric-lines">
        {lines.length ? <>
          {lines.map((line, index) => <button key={`${line.time}-${index}`} data-line={index} data-distance={Math.min(3, Math.abs(index - Math.max(0, active)))}
            className={`lyric-line ${index === active ? "active" : ""} ${active === -1 && index === 0 ? "upcoming" : ""} ${index < active ? "past" : ""}`}
            aria-current={index === active ? "true" : undefined} disabled={!canSeek}
            aria-label={`${line.text || "Instrumental"}, seek to ${formatTime(line.time)}`}
            onClick={() => { setFollowing(true); onSeek(Math.max(0, line.time - offset)); }}>
            {line.text || <span className="instrumental-dots" aria-hidden="true">&bull; &bull; &bull;</span>}
            {translations?.[index] && <span className="lyric-translation" lang="ko">{translations[index]}</span>}
          </button>)}
        </> : plainLyrics?.split("\n").map((line, index) => <p className="plain-line" key={index}>{line || "\u00a0"}{translations?.[index] && <span className="lyric-translation" lang="ko">{translations[index]}</span>}</p>)}
      </div>
    </div>
    {!lines.length && plainLyrics && <span className="unsynced-label">Timing unavailable</span>}
  </div>;
});
