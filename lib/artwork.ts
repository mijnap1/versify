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
  const tint = (rgb: number[], white: number) => `rgb(${rgb.map((value) => Math.round(value * (1 - white) + 255 * white)).join(", ")})`;
  // Night keeps the same hues but sinks them into a warm near-black instead of lifting them toward white.
  const shade = (rgb: number[], dark: number) => `rgb(${rgb.map((value, i) => Math.round(value * (1 - dark) + [22, 18, 20][i] * dark)).join(", ")})`;
  return {
    light: [tint(primary, 0.66), tint(primary, 0.9), tint(secondary, 0.57)],
    dark: [shade(primary, 0.7), shade(primary, 0.86), shade(secondary, 0.66)],
  };
}
