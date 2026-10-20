// Generates the README's animated SVGs into docs/readme/. Run: node docs/readme/generate.mjs
//
// The hero recreates Versify's listening room while "RUDE!" by Hearts2Hearts plays: the wallpaper
// is the palette Versify draws from that cover, and the lyric lines follow the song's real line
// timing. The words themselves are drawn as shapes: the README never reproduces lyrics, and the
// sleeve is an original sky illustration rather than the album artwork.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const out = join(root, "docs/readme");
mkdirSync(out, { recursive: true });
const font = readFileSync(join(root, "node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2")).toString("base64");
const fontFace = `@font-face { font-family: "Manrope"; font-weight: 200 800; src: url(data:font/woff2;base64,${font}) format("woff2"); }`;
const ease = "cubic-bezier(0.23, 1, 0.32, 1)";
const pct = (value) => `${Math.min(100, Math.max(0, value)).toFixed(3)}%`;

// Versify's wallpaper for RUDE! (start, middle, end), measured from the running app.
const rude = { start: "rgb(206, 237, 254)", middle: "rgb(241, 250, 255)", end: "rgb(190, 203, 181)" };
const sky = { deep: "#2a7fd4", mid: "#5fb0ec", low: "#bfe3f8", grass: ["#7cb55a", "#4f8a36"], blush: "#ef8fae" };

const themes = {
  light: {
    bg: [rude.start, rude.middle, rude.end], ink: "#2c3238", muted: "#66737c", line: "#2c32381f",
    card: "#ffffffa6", cardStroke: "#ffffff", accent: "#2f86d6",
  },
  dark: {
    bg: ["#0e1b29", "#122231", "#1a2a22"], ink: "#eaf4fb", muted: "#93a7b4", line: "#eaf4fb24",
    card: "#ffffff0d", cardStroke: "#ffffff21", accent: "#7cc4f5",
  },
};

// Line start times (seconds) and word lengths for the first verse of RUDE!, from its synced LRC.
const verse = [
  [5.47, [5, 5, 2]], [10.11, [5, 4]], [16.6, [4, 1, 6, 5, 2]], [17.79, [3, 2, 3, 2, 6]],
  [19.55, [5, 3, 2, 4, 4]], [22.76, [1, 5, 2, 4, 2, 5]], [25.11, [3, 2, 2, 1, 2, 4]], [26.72, [4, 1, 2, 2, 4]],
];
const verseEnd = 31.31;
const songLength = 200;

const icon = {
  expand: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
  repeat: '<path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/>',
  volume: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  heart: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
};

const heartPath = (size) => { const s = size / 24; return `M ${0} ${7 * s} C ${-14 * s} ${-2 * s} ${-9 * s} ${-14 * s} 0 ${-6 * s} C ${9 * s} ${-14 * s} ${14 * s} ${-2 * s} 0 ${7 * s} Z`; };
const cloud = (puffs, fill, extra = "") => `<g ${extra}>${puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join("")}</g>`;

function hero() {
  const start = verse[0][0];
  const rewind = 1.4;
  const cycle = verseEnd - start + rewind;
  const at = (song) => pct(((song - start) / cycle) * 100);
  const lineHeight = 64;
  const styles = [];
  const words = [];

  // Word-by-word karaoke sweep inside each line, then the line settles back as the next begins.
  verse.forEach(([time, lengths], i) => {
    const next = verse[i + 1]?.[0] ?? verseEnd;
    const sweep = Math.min((next - time) * 0.78, lengths.length * 0.42);
    let x = 0;
    lengths.forEach((length, j) => {
      const width = Math.max(20, length * 14);
      const lit = time + (sweep / lengths.length) * j;
      const name = `w${i}_${j}`;
      const first = i === 0 && j === 0;
      styles.push(`@keyframes ${name} { 0%${first ? "" : `, ${at(lit)}`} { opacity: ${first ? 1 : 0}; } ${at(lit + 0.18)}, ${at(next)} { opacity: 1; } ${at(next + 0.35)}, 100% { opacity: 0; } }`);
      words.push(`<rect x="${x}" y="${i * lineHeight - 10}" width="${width}" height="20" rx="10" class="word"/>`
        + `<rect x="${x}" y="${i * lineHeight - 10}" width="${width}" height="20" rx="10" class="sung${first ? " first" : ""}" style="animation-name:${name}"/>`);
      x += width + 11;
    });
  });

  // The column eases up one line as each line begins, like the app's lyric scroll.
  const scroll = ["0% { transform: translateY(0); }"];
  verse.slice(1).forEach(([time], index) => {
    const i = index + 1;
    scroll.push(`${at(time)} { transform: translateY(${-(i - 1) * lineHeight}px); animation-timing-function: ${ease}; }`);
    scroll.push(`${at(time + 0.56)} { transform: translateY(${-i * lineHeight}px); }`);
  });
  scroll.push(`${at(verseEnd)} { transform: translateY(${-(verse.length - 1) * lineHeight}px); animation-timing-function: ease-in-out; } 100% { transform: translateY(0); }`);

  // Elapsed time ticks once per second.
  const clock = [];
  for (let second = Math.floor(start); second <= Math.floor(verseEnd); second++) {
    const first = second === Math.floor(start);
    const to = second === Math.floor(verseEnd) ? verseEnd + rewind : second + 1;
    const visible = first ? `0%, ${at(to - 0.001)} { opacity: 1; }` : `0%, ${at(second - 0.001)} { opacity: 0; } ${at(second)}, ${at(to - 0.001)} { opacity: 1; }`;
    // The opening second shows again only on the loop's final frame, ready for the restart.
    styles.push(`@keyframes t${second} { ${visible} ${at(to)}, ${first ? "99.999%" : "100%"} { opacity: 0; }${first ? " 100% { opacity: 1; }" : ""} }`);
    clock.push(`<text x="0" y="5" class="time${first ? " first" : ""}" style="animation-name:t${second}">0:${String(second).padStart(2, "0")}</text>`);
  }

  // The heart is tapped as the chorus nears.
  const tap = 19.55;
  const bar = 300;
  const startFill = start / songLength, endFill = verseEnd / songLength;
  const transport = [
    [436, 23, `<g transform="translate(-10 -10) scale(0.84)" class="stroke">${icon.expand}</g>`],
    [518, 23, `<g transform="translate(-10.5 -10.5) scale(0.875)" class="stroke">${icon.repeat}</g>`],
    [600, 30, '<rect x="-7.5" y="-10" width="5" height="20" rx="1.6" fill="#493d45"/><rect x="2.5" y="-10" width="5" height="20" rx="1.6" fill="#493d45"/>'],
    [682, 23, `<g transform="translate(-10.5 -10.5) scale(0.875)" class="stroke">${icon.volume}</g>`],
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 740" width="1200" height="740" role="img" aria-labelledby="title desc">
  <title id="title">Versify playing RUDE! by Hearts2Hearts</title>
  <desc id="desc">The Versify listening room: a record slides out from a sky-blue sleeve and spins while lyric lines light up word by word in time with the song.</desc>
  <style>
    ${fontFace}
    text { font-family: "Manrope", "Segoe UI", system-ui, sans-serif; }
    .drift { animation: drift linear infinite; }
    @keyframes drift { from { transform: translateX(-260px); } to { transform: translateX(1460px); } }
    .float { animation: float 9s ease-in-out infinite alternate; }
    @keyframes float { to { transform: translateY(-14px); } }
    .vinyl { animation: slide 1.1s ${ease} 0.35s both; }
    @keyframes slide { from { transform: translateX(-52px); } }
    .spin { animation: spin 5s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .sleeve-cloud { animation: breeze 14s ease-in-out infinite alternate; }
    @keyframes breeze { to { transform: translateX(18px); } }
    .word { fill: #2c32381f; }
    .sung { fill: #343c44; opacity: 0; animation-duration: ${cycle}s; animation-iteration-count: infinite; animation-timing-function: ease-out; }
    .scroll { animation: scroll ${cycle}s linear infinite; }
    @keyframes scroll { ${scroll.join(" ")} }
    .time { font-size: 13px; font-weight: 500; fill: #8a8f94; opacity: 0; animation-duration: ${cycle}s; animation-iteration-count: infinite; animation-timing-function: step-end; }
    .fill { animation: fill ${cycle}s linear infinite; transform-box: fill-box; transform-origin: left center; }
    @keyframes fill { from { transform: scaleX(${startFill}); } ${at(verseEnd)} { transform: scaleX(${endFill}); animation-timing-function: ease-in-out; } to { transform: scaleX(${startFill}); } }
    .knob { animation: knob ${cycle}s linear infinite; }
    @keyframes knob { from { transform: translateX(${bar * startFill}px); } ${at(verseEnd)} { transform: translateX(${bar * endFill}px); animation-timing-function: ease-in-out; } to { transform: translateX(${bar * startFill}px); } }
    .loved { opacity: 0; animation: loved ${cycle}s ${ease} infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes loved { 0%, ${at(tap)} { opacity: 0; transform: scale(0.4); } ${at(tap + 0.45)} { opacity: 1; transform: scale(1.18); } ${at(tap + 0.8)}, ${at(verseEnd)} { opacity: 1; transform: scale(1); } ${at(verseEnd + 0.6)}, 100% { opacity: 0; transform: scale(1); } }
    .press { animation: press ${cycle}s ${ease} infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes press { 0%, ${at(tap - 0.12)} { transform: scale(1); } ${at(tap)} { transform: scale(0.9); } ${at(tap + 0.5)}, 100% { transform: scale(1); } }
    .burst { opacity: 0; animation: burst ${cycle}s ease-out infinite; }
    @keyframes burst { 0%, ${at(tap + 0.1)} { opacity: 0; transform: translate(0, 0) scale(0.5); } ${at(tap + 0.4)} { opacity: 1; } ${at(tap + 2.2)}, 100% { opacity: 0; transform: translate(var(--dx), -70px) scale(1); } }
    .stroke { fill: none; stroke: #84757e; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    ${styles.join("\n    ")}
    @media (prefers-reduced-motion: reduce) {
      .drift, .float, .vinyl, .spin, .sleeve-cloud, .sung, .scroll, .time, .fill, .knob, .loved, .press, .burst { animation: none; }
      .sung.first, .time.first { opacity: 1; }
    }
  </style>
  <defs>
    <linearGradient id="wallpaper" x1="0.12" y1="0" x2="0.88" y2="1">
      <stop offset="0" stop-color="${rude.start}"/><stop offset="0.53" stop-color="${rude.middle}"/><stop offset="1" stop-color="${rude.end}"/>
    </linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${sky.deep}"/><stop offset="0.5" stop-color="${sky.mid}"/><stop offset="0.8" stop-color="${sky.low}"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.78" cy="0.12" r="0.6">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${sky.grass[0]}"/><stop offset="1" stop-color="${sky.grass[1]}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.62"/><stop offset="0.65" stop-color="#ffffff" stop-opacity="0.2"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.42"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.34" stop-color="#fff"/><stop offset="0.58" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="lyrics"><rect x="620" y="150" width="560" height="420" fill="url(#fade)"/></mask>
    <filter id="haze" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="puff" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="22" stdDeviation="20" flood-color="#2d3d4c" flood-opacity="0.22"/></filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#3a5368" flood-opacity="0.08"/></filter>
    <clipPath id="frame"><rect width="1200" height="740" rx="28"/></clipPath>
    <clipPath id="sleeve"><rect x="110" y="190" width="320" height="320" rx="6"/></clipPath>
    <path id="label-ring" d="M 0 -33 a 33 33 0 1 1 -0.01 0"/>
  </defs>

  <g clip-path="url(#frame)">
    <rect width="1200" height="740" fill="url(#wallpaper)"/>

    <!-- Clouds drifting across the room -->
    <g filter="url(#haze)" opacity="0.75">
      <g transform="translate(0 130)">${cloud([[0, 0, 46], [50, -14, 58], [104, 2, 44], [56, 22, 40]], "#ffffff", 'class="drift" style="animation-duration:95s;animation-delay:-38s"')}</g>
      <g transform="translate(0 600)">${cloud([[0, 0, 34], [40, -10, 44], [82, 4, 32]], "#ffffff", 'class="drift" style="animation-duration:120s;animation-delay:-90s"')}</g>
      <g transform="translate(0 300)">${cloud([[0, 0, 28], [34, -8, 36], [66, 2, 26]], "#ffffff", 'class="drift" style="animation-duration:80s;animation-delay:-12s"')}</g>
    </g>
    <g class="float" opacity="0.55" filter="url(#puff)">
      <path d="${heartPath(56)}" transform="translate(1092 132)" fill="#ffffff"/>
      <path d="${heartPath(34)}" transform="translate(1040 186)" fill="#ffffff"/>
    </g>

    <!-- Header: clock, search, more -->
    <text x="404" y="77" text-anchor="end" font-size="17" font-weight="500" fill="#5d666d" letter-spacing="0.5">12:43</text>
    <g filter="url(#soft)">
      <rect x="424" y="46" width="350" height="50" rx="25" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.75"/>
      <circle cx="806" cy="71" r="25" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.75"/>
    </g>
    <g transform="translate(446 61) scale(0.85)" class="stroke" style="stroke:#6d6971"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></g>
    <text x="478" y="77" font-size="15.5" font-weight="400" fill="#7d7880">Find a song...</text>
    <g fill="#6d6971"><circle cx="797" cy="71" r="2"/><circle cx="806" cy="71" r="2"/><circle cx="815" cy="71" r="2"/></g>

    <!-- Record and sleeve -->
    <g class="vinyl">
      <g transform="translate(384 352)">
        <g class="spin">
          <circle r="149" fill="#111316"/>
          ${Array.from({ length: 16 }, (_, i) => `<circle r="${60 + i * 5.6}" fill="none" stroke="#ffffff" stroke-opacity="0.06"/>`).join("")}
          <circle r="49" fill="${sky.mid}"/>
          <circle r="49" fill="url(#sun)"/>
          <text font-size="8.5" font-weight="700" letter-spacing="1.8" fill="#ffffffd9"><textPath href="#label-ring">HEARTS2HEARTS · RUDE! · SIDE A ·</textPath></text>
          <circle r="4.5" fill="#111316"/>
        </g>
        <path d="M -118 -90 A 149 149 0 0 1 90 -118 L 30 -40 A 50 50 0 0 0 -40 -30 Z" fill="#ffffff" opacity="0.06"/>
      </g>
    </g>
    <g filter="url(#lift)"><rect x="110" y="190" width="320" height="320" rx="6" fill="url(#sky)"/></g>
    <g clip-path="url(#sleeve)">
      <rect x="110" y="190" width="320" height="320" fill="url(#sun)"/>
      <g class="sleeve-cloud" filter="url(#puff)">
        ${cloud([[150, 262, 26], [182, 248, 34], [222, 258, 28], [196, 276, 24]], "#ffffff", 'opacity="0.95"')}
        <path d="${heartPath(84)}" transform="translate(320 262)" fill="#ffffff"/>
        <path d="${heartPath(46)}" transform="translate(386 318)" fill="#ffffff" opacity="0.92"/>
        ${cloud([[128, 352, 22], [160, 344, 28], [196, 352, 20]], "#ffffff", 'opacity="0.85"')}
        ${cloud([[300, 372, 18], [328, 364, 24], [358, 374, 17]], "#ffffff", 'opacity="0.8"')}
      </g>
      <path d="M 110 452 C 190 424 300 430 430 446 L 430 510 L 110 510 Z" fill="url(#grass)"/>
      <path d="M 110 470 C 210 452 330 458 430 470 L 430 510 L 110 510 Z" fill="${sky.grass[1]}" opacity="0.55"/>
      <path d="${heartPath(18)}" transform="translate(146 486)" fill="${sky.blush}" opacity="0.9"/>
    </g>

    <text x="110" y="567" font-size="35" font-weight="550" fill="#2c3238">RUDE!</text>
    <text x="111" y="602" font-size="19" font-weight="400" fill="#6f777d">Hearts2Hearts</text>

    <!-- Lyrics, drawn as words rather than text -->
    <g mask="url(#lyrics)">
      <g transform="translate(640 350)">
        <g class="scroll">
          ${words.join("\n          ")}
        </g>
      </g>
    </g>

    <!-- Transport -->
    <g filter="url(#soft)">
      ${transport.map(([x, r]) => `<circle cx="${x}" cy="640" r="${r}" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.8"/>`).join("")}
      <g class="press"><circle cx="764" cy="640" r="23" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.8"/></g>
    </g>
    ${transport.map(([x, , glyph]) => `<g transform="translate(${x} 640)">${glyph}</g>`).join("")}
    <g transform="translate(764 640)">
      <g transform="translate(-10 -10) scale(0.83)"><path d="${icon.heart}" class="stroke"/></g>
      <g transform="translate(-10 -10) scale(0.83)"><path d="${icon.heart}" class="loved" fill="${sky.blush}" stroke="${sky.blush}" stroke-width="1.8" stroke-linejoin="round"/></g>
      ${[[-26, 14, 0], [4, 10, 0.12], [24, 12, 0.22]].map(([dx, size, delay]) => `<path d="${heartPath(size)}" class="burst" style="--dx:${dx}px;animation-delay:${delay}s" fill="${sky.blush}"/>`).join("")}
    </g>

    <!-- Progress -->
    <g transform="translate(420 700)">${clock.join("")}</g>
    <g transform="translate(450 700)">
      <rect x="0" y="-8" width="${bar}" height="16" rx="8" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.75"/>
      <rect x="6" y="-2" width="${bar - 12}" height="4" rx="2" fill="#2c323814"/>
      <rect class="fill" x="6" y="-2" width="${bar - 12}" height="4" rx="2" fill="#2c3238" opacity="0.55"/>
      <g class="knob"><circle cx="6" cy="0" r="6" fill="#ffffff" stroke="#2c32381a"/></g>
    </g>
    <text x="772" y="705" font-size="13" font-weight="500" fill="#8a8f94">3:20</text>
    <text x="1168" y="722" text-anchor="end" font-size="11.5" font-weight="500" fill="#7d858a">© 2026 Jamie Ryu</text>
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
  const track = 4 * width + 3 * gap;
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
    <linearGradient id="flow-bg-${name}" x1="0.12" y1="0" x2="0.88" y2="1">
      <stop offset="0" stop-color="${t.bg[0]}"/><stop offset="0.53" stop-color="${t.bg[1]}"/><stop offset="1" stop-color="${t.bg[2]}"/>
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

// The app icon on a sky tile, so the black mark reads on GitHub's light and dark themes alike.
function logo() {
  const mark = readFileSync(join(root, "app/apple-icon.png")).toString("base64");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img" aria-labelledby="title">
  <title id="title">Versify</title>
  <style>
    .sheen { animation: sheen 7s ${ease} infinite; }
    @keyframes sheen { 0%, 62% { transform: translateX(-260px); } 100% { transform: translateX(260px); } }
    @media (prefers-reduced-motion: reduce) { .sheen { animation: none; transform: translateX(-260px); } }
  </style>
  <defs>
    <linearGradient id="tile" x1="0.12" y1="0" x2="0.88" y2="1">
      <stop offset="0" stop-color="${rude.start}"/><stop offset="0.53" stop-color="${rude.middle}"/><stop offset="1" stop-color="${rude.end}"/>
    </linearGradient>
    <radialGradient id="bloom" cx="0.25" cy="0.18" r="0.75">
      <stop offset="0" stop-color="${sky.mid}" stop-opacity="0.35"/><stop offset="1" stop-color="${sky.mid}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
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

writeFileSync(join(out, "hero.svg"), hero());
writeFileSync(join(out, "logo.svg"), logo());
for (const [name, theme] of Object.entries(themes)) writeFileSync(join(out, `flow-${name}.svg`), flow(name, theme));
console.log("wrote", out);
