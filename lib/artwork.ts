export type WallpaperPalette = [string, string, string];
export type ThemedPalette = { light: WallpaperPalette; dark: WallpaperPalette };

export const defaultPalette: ThemedPalette = {
  light: ["rgb(238, 218, 220)", "rgb(249, 242, 242)", "rgb(223, 197, 201)"],
  dark: ["rgb(58, 44, 49)", "rgb(32, 26, 29)", "rgb(66, 47, 54)"],
};

// Quantize a small canvas sample so sleeve text and compression noise don't dominate.
export function artworkPalette(pixels: Uint8ClampedArray): ThemedPalette {
  const buckets = new Map<string, { rgb: number[]; count: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const maximum = Math.max(...rgb);
    const minimum = Math.min(...rgb);
    if (maximum < 35 || minimum > 235 || maximum - minimum < 18) continue;
    const key = rgb.map((value) => Math.floor(value / 32)).join(",");
    const bucket = buckets.get(key);
    if (bucket) { bucket.count++; rgb.forEach((value, channel) => { bucket.rgb[channel] += value; }); }
    else buckets.set(key, { rgb, count: 1 });
  }
  const colors = [...buckets.values()].sort((a, b) => b.count - a.count)
    .map(({ rgb, count }) => ({ rgb: rgb.map((value) => value / count), count }));
  const primary = colors[0]?.rgb ?? [142, 151, 160];
  const strongestChannel = (rgb: number[]) => rgb.indexOf(Math.max(...rgb));
  const secondary = colors.find((color) => color.count >= colors[0].count * 0.08 &&
    Math.max(...color.rgb) - Math.min(...color.rgb) > 45 &&
    strongestChannel(color.rgb) !== strongestChannel(primary) &&
    color.rgb.reduce((distance, value, i) => distance + (value - primary[i]) ** 2, 0) > 8000)?.rgb ?? primary;
  // Day sets lightness directly and boosts saturation, so muted sleeves still give a clearly coloured (but light) room.
  const pastel = (rgb: number[], lightness: number) => {
    const [r, g, b] = rgb.map((value) => value / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), chroma = max - min;
    const hue = chroma === 0 ? 0 : max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
    const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(max + min - 1));
    const vivid = Math.min(0.55, saturation * 1.4 + 0.15) * (chroma === 0 ? 0 : 1);
    const c = (1 - Math.abs(2 * lightness - 1)) * vivid, x = c * (1 - Math.abs((((hue % 6) + 6) % 6) % 2 - 1)), m = lightness - c / 2;
    const sector = Math.floor(((hue % 6) + 6) % 6);
    const [r1, g1, b1] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector];
    return `rgb(${[r1, g1, b1].map((value) => Math.round((value + m) * 255)).join(", ")})`;
  };
  // Night keeps the same hues but sinks them into a warm near-black instead of lifting them toward white.
  const shade = (rgb: number[], dark: number) => `rgb(${rgb.map((value, i) => Math.round(value * (1 - dark) + [22, 18, 20][i] * dark)).join(", ")})`;
  return {
    light: [pastel(primary, 0.8), pastel(primary, 0.91), pastel(secondary, 0.76)],
    dark: [shade(primary, 0.7), shade(primary, 0.86), shade(secondary, 0.66)],
  };
}
