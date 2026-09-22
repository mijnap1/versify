import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { languages, type Settings } from "@/lib/settings";

function SettingPicker({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const menu = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (details.current && (event.type === "resize" || (event.target instanceof Node && event.target.contains(details.current)))) details.current.open = false;
    };
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => { window.removeEventListener("resize", dismiss); window.removeEventListener("scroll", dismiss, true); };
  }, []);
  function close() { if (details.current) { details.current.open = false; details.current.querySelector("summary")?.focus(); } }
  return <details className="setting-picker" name="setting-picker" ref={details}
    onToggle={(event) => {
      if (event.target !== event.currentTarget || !menu.current) return;
      if (!event.currentTarget.open) { menu.current.hidePopover(); return; }
      const anchor = event.currentTarget.querySelector("summary")!.getBoundingClientRect();
      const options = menu.current;
      options.style.width = `${anchor.width}px`;
      options.showPopover();
      const height = options.getBoundingClientRect().height;
      options.style.left = `${anchor.left}px`;
      options.style.top = `${Math.max(8, anchor.bottom + height + 8 < window.innerHeight ? anchor.bottom + 8 : anchor.top - height - 8)}px`;
    }}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && details.current) details.current.open = false; }}
    onKeyDown={(event) => { if (event.key === "Escape" && details.current?.open) { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <summary aria-label={`${label}: ${options.find(([key]) => key === value)?.[1]}`}><span>{options.find(([key]) => key === value)?.[1]}</span><ChevronDown size={16} /></summary>
    <fieldset ref={menu} popover="auto" className="setting-options" onToggle={(event) => { if (event.newState === "closed" && details.current) details.current.open = false; }}><legend className="sr-only">{label}</legend>
      {options.map(([key, text]) => <label className="setting-option" key={key}>
        <input type="radio" aria-label={text} name={id} value={key} checked={value === key} onChange={() => onChange(key)} onClick={close} />
        <span>{text}</span><Check size={16} aria-hidden="true" />
      </label>)}
    </fieldset>
  </details>;
}

export function SettingsPanel({ settings, onChange, error }: { settings: Settings; onChange: (settings: Settings) => void; error: string }) {
  return <div className="settings-panel">
    <div className="settings-card">
      <section className="settings-section"><div className="settings-label"><div><h3>Clock</h3></div></div>
        <SettingPicker label="Clock format" value={settings.hour12 ? "12" : "24"} options={[["24", "24-hour"], ["12", "12-hour"]]} onChange={(value) => onChange({ ...settings, hour12: value === "12" })} />
      </section>
      <section className="settings-section"><div className="settings-label"><div><h3>Translation</h3></div></div>
        <SettingPicker label="Translation language" value={settings.language} options={Object.entries(languages)} onChange={(value) => onChange({ ...settings, language: value as Settings["language"] })} />
      </section>
      <section className="settings-section"><div className="settings-label"><div><h3>Lyric size</h3></div></div>
        <SettingPicker label="Lyric size" value={String(settings.lyricScale)} options={[["1", "Default"], ["1.15", "15% bigger"], ["1.3", "30% bigger"], ["1.5", "50% bigger"]]} onChange={(value) => onChange({ ...settings, lyricScale: Number(value) })} />
      </section>
    </div>
    {error && <p className="settings-error" role="status">{error}</p>}
  </div>;
}
