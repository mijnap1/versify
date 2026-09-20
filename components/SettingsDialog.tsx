import { Check, ChevronDown, X } from "lucide-react";
import { useId, useRef, type RefObject } from "react";
import { languages, type Settings } from "@/lib/settings";

function SettingPicker({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);
  function close() { if (details.current) { details.current.open = false; details.current.querySelector("summary")?.focus(); } }
  return <details className="setting-picker" name="setting-picker" ref={details}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && details.current) details.current.open = false; }}
    onKeyDown={(event) => { if (event.key === "Escape" && details.current?.open) { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <summary aria-label={`${label}: ${options.find(([key]) => key === value)?.[1]}`}><span>{options.find(([key]) => key === value)?.[1]}</span><ChevronDown size={16} /></summary>
    <fieldset className="setting-options"><legend className="sr-only">{label}</legend>
      {options.map(([key, text]) => <label className="setting-option" key={key}>
        <input type="radio" name={id} value={key} checked={value === key} onChange={() => onChange(key)} onClick={close} />
        <span>{text}</span><Check size={16} aria-hidden="true" />
      </label>)}
    </fieldset>
  </details>;
}

export function SettingsDialog({ dialogRef, settings, onChange, error }: { dialogRef: RefObject<HTMLDialogElement | null>; settings: Settings; onChange: (settings: Settings) => void; error: string }) {
  return <dialog ref={dialogRef} className="source-dialog favorites-dialog settings-dialog" aria-labelledby="settings-title"
    onClose={() => dialogRef.current?.querySelectorAll("details").forEach((element) => { element.open = false; })}
    onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
    <div className="dialog-heading"><h2 id="settings-title">Settings</h2><button className="icon-button" aria-label="Close settings" onClick={() => dialogRef.current?.close()}><X size={19} /></button></div>
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
  </dialog>;
}
