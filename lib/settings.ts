export const languages = { ko: "Korean", ja: "Japanese", "zh-CN": "Chinese (Simplified)", fr: "French", es: "Spanish", pt: "Portuguese" };
export const themes = { system: "Match system", light: "Day", dark: "Night" };
export type Settings = { hour12: boolean; language: keyof typeof languages; lyricScale: number; theme: keyof typeof themes };
export const defaultSettings: Settings = { hour12: false, language: "ko", lyricScale: 1, theme: "light" };
export function readSettings(value: unknown): Settings {
  const data = (value && typeof value === "object" ? value : {}) as Partial<Settings>;
  return {
    hour12: data.hour12 === true,
    language: data.language && Object.hasOwn(languages, data.language) ? data.language : "ko",
    lyricScale: [1, 1.15, 1.3, 1.5].includes(data.lyricScale ?? 0) ? data.lyricScale! : 1,
    theme: data.theme && Object.hasOwn(themes, data.theme) ? data.theme : "light",
  };
}
