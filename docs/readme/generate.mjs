// Generates the README's animated SVGs (light + dark) into docs/readme/. Run: node docs/readme/generate.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const out = join(root, "docs/readme");
mkdirSync(out, { recursive: true });
const font = readFileSync(join(root, "node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2")).toString("base64");
const fontFace = `@font-face { font-family: "Manrope"; font-weight: 200 800; src: url(data:font/woff2;base64,${font}) format("woff2"); }`;
const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

const themes = {
  light: {
    bg: ["#f7efef", "#f2e3e5", "#ead6da"], blobs: ["#f1c7cf", "#d9c6ea", "#f7d9c4"], blobOpacity: 0.85,
    ink: "#302a2b", muted: "#7a6f74", dim: "#302a2b38", line: "#302a2b1c", card: "#ffffff8c", cardStroke: "#ffffffd9",
    sleeve: ["#f4b9c4", "#d6b3e6", "#f9d8bf"], sun: "#fff4ee", accent: "#c0697f", groove: "#ffffff12", vinyl: "#171214",
    label: ["#f3c3cc", "#c99ad6"], shadow: "#5a3a4a",
  },
  dark: {
    bg: ["#1d1719", "#211a1e", "#191416"], blobs: ["#7a3a4f", "#4b3d78", "#7a5236"], blobOpacity: 0.42,
    ink: "#f4ecee", muted: "#a99ba1", dim: "#f4ecee33", line: "#f4ecee1f", card: "#ffffff0d", cardStroke: "#ffffff1f",
    sleeve: ["#b5576e", "#6b4f9c", "#c98a63"], sun: "#ffd9cf", accent: "#e48aa1", groove: "#ffffff10", vinyl: "#0c090a",
    label: ["#d47b91", "#8a64b8"], shadow: "#000000",
  },
};

// Original lines in Versify's voice — the README never quotes real lyrics.
const lines = [
  ["00:04.20", "Find the song you mean."],
  ["00:08.75", "Settle into its artwork."],
  ["00:13.10", "Let every line meet the music,"],
  ["00:17.62", "right on time."],
  ["00:21.48", "A quieter way to listen."],
];

function hero(name, t) {
  const cycle = lines.length * 3; // seconds; each line holds for 3s
  const step = 100 / lines.length;
  const lineHeight = 66;
  const scroll = lines.map((_, i) => {
    const start = i * step;
    const hold = i === lines.length - 1 ? 97.5 : start + step;
    return `${(start + (i ? 2.2 : 0)).toFixed(2)}% { transform: translateY(${-i * lineHeight}px); } ${hold.toFixed(2)}% { transform: translateY(${-i * lineHeight}px); }`;
  }).join(" ") + " 100% { transform: translateY(0); }";
  const grooves = Array.from({ length: 15 }, (_, i) => `<circle cx="0" cy="0" r="${62 + i * 6}" fill="none" stroke="${t.groove}" stroke-width="1"/>`).join("");
  const lyric = lines.map(([time, text], i) => `
      <g class="line" transform="translate(0 ${i * lineHeight})">
        <text class="time" x="0" y="0" style="animation-delay:${i ? -(cycle - i * 3) : 0}s">[${time}]</text>
        <text class="words" x="96" y="0" style="animation-delay:${i ? -(cycle - i * 3) : 0}s">${text}</text>
      </g>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600" role="img" aria-labelledby="title desc">
  <title id="title">Versify</title>
  <desc id="desc">A record spins behind its sleeve while lyric lines light up one at a time, in step with the music.</desc>
  <style>
    ${fontFace}
    text { font-family: "Manrope", "Segoe UI", system-ui, sans-serif; }
    .blob { animation: drift 18s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
    .blob.b2 { animation-duration: 23s; animation-delay: -6s; }
    .blob.b3 { animation-duration: 27s; animation-delay: -11s; }
    @keyframes drift { from { transform: translate(-30px, -10px) scale(1); } to { transform: translate(40px, 24px) scale(1.12); } }
    .record { animation: spin 7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .scroll { animation: scroll ${cycle}s ${ease} infinite; }
    @keyframes scroll { 0% { transform: translateY(0); } ${scroll} }
    .words { font-size: 29px; font-weight: 500; fill: ${t.dim}; animation: glow ${cycle}s ease infinite; }
    .time { font-size: 14px; font-weight: 600; fill: ${t.dim}; letter-spacing: 0.03em; animation: tick ${cycle}s ease infinite; }
    @keyframes glow { 0%, 18.5% { fill: ${t.ink}; } 21%, 98% { fill: ${t.dim}; } 100% { fill: ${t.ink}; } }
    @keyframes tick { 0%, 18.5% { fill: ${t.accent}; } 21%, 98% { fill: ${t.dim}; } 100% { fill: ${t.accent}; } }
    .progress { animation: progress ${cycle}s linear infinite; transform-box: fill-box; transform-origin: left center; }
    @keyframes progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    .knob { animation: knob ${cycle}s linear infinite; }
    @keyframes knob { from { transform: translateX(0); } to { transform: translateX(470px); } }
    @media (prefers-reduced-motion: reduce) {
      .blob, .record, .scroll, .words, .time, .progress, .knob { animation: none; }
      .progress { transform: scaleX(0.35); }
      .knob { transform: translateX(165px); }
    }
  </style>
  <defs>
    <linearGradient id="bg-${name}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.bg[0]}"/><stop offset="0.55" stop-color="${t.bg[1]}"/><stop offset="1" stop-color="${t.bg[2]}"/>
    </linearGradient>
    <filter id="soft-${name}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>
    <filter id="shadow-${name}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="${t.shadow}" flood-opacity="0.22"/>
    </filter>
    <linearGradient id="sleeve-${name}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.sleeve[0]}"/><stop offset="0.55" stop-color="${t.sleeve[1]}"/><stop offset="1" stop-color="${t.sleeve[2]}"/>
    </linearGradient>
    <radialGradient id="sun-${name}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${t.sun}" stop-opacity="0.95"/><stop offset="0.6" stop-color="${t.sun}" stop-opacity="0.35"/><stop offset="1" stop-color="${t.sun}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="label-${name}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.label[0]}"/><stop offset="1" stop-color="${t.label[1]}"/>
    </linearGradient>
    <linearGradient id="fade-${name}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.36" stop-color="#fff" stop-opacity="1"/>
      <stop offset="0.56" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="lyrics-mask-${name}"><rect x="570" y="120" width="630" height="345" fill="url(#fade-${name})"/></mask>
    <clipPath id="frame-${name}"><rect width="1200" height="600" rx="28"/></clipPath>
    <clipPath id="sleeve-clip-${name}"><rect x="96" y="120" width="290" height="290" rx="8"/></clipPath>
    <path id="label-path-${name}" d="M 0 -35 a 35 35 0 1 1 -0.01 0"/>
  </defs>

  <g clip-path="url(#frame-${name})">
    <rect width="1200" height="600" fill="url(#bg-${name})"/>
    <g filter="url(#soft-${name})" opacity="${t.blobOpacity}">
      <circle class="blob" cx="260" cy="170" r="190" fill="${t.blobs[0]}"/>
      <circle class="blob b2" cx="930" cy="420" r="230" fill="${t.blobs[1]}"/>
      <circle class="blob b3" cx="640" cy="80" r="150" fill="${t.blobs[2]}"/>
    </g>

    <!-- Record peeking out from its sleeve -->
    <g transform="translate(378 265)">
      <g class="record">
        <circle r="148" fill="${t.vinyl}"/>
        ${grooves}
        <circle r="50" fill="url(#label-${name})"/>
        <text font-size="8.5" font-weight="700" letter-spacing="1.6" fill="#ffffffcc"><textPath href="#label-path-${name}">VERSIFY · SIDE A · LYRICS IN TIME ·</textPath></text>
        <circle r="5" fill="${t.vinyl}"/>
      </g>
      <path d="M -120 -86 A 148 148 0 0 1 86 -120 L 30 -40 A 50 50 0 0 0 -40 -30 Z" fill="#ffffff" opacity="0.05"/>
    </g>
    <g filter="url(#shadow-${name})">
      <rect x="96" y="120" width="290" height="290" rx="8" fill="url(#sleeve-${name})"/>
    </g>
    <g clip-path="url(#sleeve-clip-${name})">
      <circle cx="262" cy="232" r="120" fill="url(#sun-${name})"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${126 + (i % 2) * 22}" y="${300 + i * 13}" width="${150 - i * 18 + (i % 3) * 22}" height="3" rx="1.5" fill="#ffffff" opacity="${0.55 - i * 0.06}"/>`).join("")}
      <text x="120" y="388" font-size="13" font-weight="700" letter-spacing="3" fill="#ffffffd9">VERSIFY</text>
    </g>

    <g>
      <text x="96" y="476" font-size="42" font-weight="600" fill="${t.ink}" letter-spacing="-0.5">Versify</text>
    </g>
    <g>
      <text x="98" y="512" font-size="19" font-weight="400" fill="${t.muted}">Lyrics that move with the music</text>
    </g>

    <!-- Synchronized lyrics -->
    <g mask="url(#lyrics-mask-${name})">
      <g transform="translate(592 290)">
        <g class="scroll">${lyric}
        </g>
      </g>
    </g>

    <!-- Playback -->
    <g transform="translate(592 528)">
      <rect x="0" y="-9" width="4" height="18" rx="2" fill="${t.ink}"/>
      <rect x="9" y="-9" width="4" height="18" rx="2" fill="${t.ink}"/>
      <g transform="translate(40 0)">
        <rect x="0" y="-2" width="470" height="4" rx="2" fill="${t.line}"/>
        <rect class="progress" x="0" y="-2" width="470" height="4" rx="2" fill="${t.ink}" opacity="0.75"/>
        <circle class="knob" cx="0" cy="0" r="6.5" fill="${t.ink}"/>
      </g>
      <text x="540" y="6" font-size="15" font-weight="500" fill="${t.muted}">0:15</text>
    </g>
  </g>
</svg>
`;
}

function flow(name, t) {
  const steps = [
    ["01", "Search", "Apple's catalog", "the recording you mean"],
    ["02", "Words", "LRCLIB", "timed, line by line"],
    ["03", "Recording", "YouTube Music", "the same master recording"],
    ["04", "In sync", "Versify", "each line on its moment"],
  ];
  const width = 255, gap = 26, x0 = 51, cycle = 8;
  const cards = steps.map(([n, title, source, note], i) => {
    const x = x0 + i * (width + gap);
    return `
    <g transform="translate(${x} 34)">
      <rect class="card" style="animation-delay:${(i * cycle) / 4.6}s" width="${width}" height="168" rx="22" fill="${t.card}" stroke="${t.cardStroke}" stroke-width="1.5"/>
      <text x="26" y="44" font-size="14" font-weight="700" letter-spacing="2.5" fill="${t.accent}">${n}</text>
      <text x="26" y="88" font-size="27" font-weight="600" fill="${t.ink}">${title}</text>
      <text x="26" y="118" font-size="16" font-weight="600" fill="${t.muted}">${source}</text>
      <text x="26" y="142" font-size="15" font-weight="400" fill="${t.muted}" opacity="0.85">${note}</text>
    </g>`;
  }).join("");
  const track = x0 + 4 * width + 3 * gap - x0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 262" width="1200" height="262" role="img" aria-labelledby="title desc">
  <title id="title">How a song finds its words</title>
  <desc id="desc">Search the Apple catalog, find timed lyrics on LRCLIB, match the same master recording on YouTube Music, and play it in sync.</desc>
  <style>
    ${fontFace}
    text { font-family: "Manrope", "Segoe UI", system-ui, sans-serif; }
    .card { animation: lift ${cycle}s ease-in-out infinite backwards; }
    @keyframes lift { 0% { stroke: ${t.cardStroke}; } 6%, 20% { stroke: ${t.accent}; } 30%, 100% { stroke: ${t.cardStroke}; } }
    .pulse { animation: travel ${cycle}s ${ease} infinite; }
    @keyframes travel {
      ${steps.map((_, i) => `${i ? (i * 21.7 + 4).toFixed(1) : 0}% { transform: translateX(${(i * (width + gap)) + width / 2}px); } ${(i * 21.7 + 15).toFixed(1)}% { transform: translateX(${(i * (width + gap)) + width / 2}px); }`).join(" ")}
      80.1% { opacity: 1; } 95% { transform: translateX(${track}px); opacity: 0; } 99.9% { transform: translateX(${width / 2}px); opacity: 0; } 100% { opacity: 1; }
    }
    .glow { animation: breathe 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes breathe { 50% { transform: scale(1.6); opacity: 0.25; } }
    @media (prefers-reduced-motion: reduce) { .card, .pulse, .glow { animation: none; } .pulse { transform: translateX(${width / 2}px); } }
  </style>
  <defs>
    <linearGradient id="flow-bg-${name}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.bg[0]}"/><stop offset="0.55" stop-color="${t.bg[1]}"/><stop offset="1" stop-color="${t.bg[2]}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="262" rx="28" fill="url(#flow-bg-${name})"/>
  <line x1="${x0}" y1="232" x2="${x0 + track}" y2="232" stroke="${t.line}" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>
  ${cards}
  <g transform="translate(${x0} 232)">
    <g class="pulse">
      <circle class="glow" r="9" fill="${t.accent}" opacity="0.45"/>
      <circle r="5" fill="${t.accent}"/>
    </g>
  </g>
</svg>
`;
}

// The app icon on a light tile, so the black mark reads on GitHub's light and dark themes alike.
function logo() {
  const mark = readFileSync(join(root, "app/apple-icon.png")).toString("base64");
  const t = themes.light;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img" aria-labelledby="title">
  <title id="title">Versify</title>
  <style>
    .sheen { animation: sheen 7s ${ease} infinite; }
    @keyframes sheen { 0%, 62% { transform: translateX(-260px); } 100% { transform: translateX(260px); } }
    @media (prefers-reduced-motion: reduce) { .sheen { animation: none; transform: translateX(-260px); } }
  </style>
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbf6f6"/><stop offset="0.55" stop-color="${t.bg[1]}"/><stop offset="1" stop-color="${t.bg[2]}"/>
    </linearGradient>
    <radialGradient id="bloom" cx="0.3" cy="0.22" r="0.8">
      <stop offset="0" stop-color="${t.blobs[0]}" stop-opacity="0.55"/><stop offset="1" stop-color="${t.blobs[1]}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="clip"><rect width="240" height="240" rx="54"/></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="240" height="240" fill="url(#tile)"/>
    <rect width="240" height="240" fill="url(#bloom)"/>
    <image href="data:image/png;base64,${mark}" x="45" y="45" width="150" height="150"/>
    <g transform="rotate(20 120 120)"><rect class="sheen" x="75" y="-60" width="90" height="360" fill="url(#sheen)" opacity="0.7"/></g>
  </g>
  <rect x="0.75" y="0.75" width="238.5" height="238.5" rx="53.5" fill="none" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"/>
</svg>
`;
}
writeFileSync(join(out, "logo.svg"), logo());

for (const [name, theme] of Object.entries(themes)) {
  writeFileSync(join(out, `hero-${name}.svg`), hero(name, theme));
  writeFileSync(join(out, `flow-${name}.svg`), flow(name, theme));
}
console.log("wrote", out);
