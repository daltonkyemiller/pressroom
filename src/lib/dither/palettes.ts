export type Color = readonly [number, number, number];
export type PaletteId = "bw" | "cream" | "gameboy" | "amber" | "cyan" | "redink";

export const PALETTES: Record<PaletteId, readonly Color[]> = {
  bw: [
    [0, 0, 0],
    [255, 255, 255],
  ],
  cream: [
    [26, 22, 16],
    [239, 236, 230],
  ],
  gameboy: [
    [15, 56, 15],
    [48, 98, 48],
    [139, 172, 15],
    [155, 188, 15],
  ],
  amber: [
    [26, 10, 0],
    [255, 136, 0],
  ],
  cyan: [
    [0, 26, 26],
    [0, 255, 213],
  ],
  redink: [
    [26, 0, 0],
    [255, 77, 46],
    [245, 230, 220],
  ],
};

export const PALETTE_META: { id: PaletteId; label: string }[] = [
  { id: "bw", label: "b&w" },
  { id: "cream", label: "cream" },
  { id: "gameboy", label: "gb" },
  { id: "amber", label: "amber" },
  { id: "cyan", label: "cyan" },
  { id: "redink", label: "red" },
];

export function nearestColor(
  r: number,
  g: number,
  b: number,
  palette: readonly Color[],
): Color {
  let best = palette[0];
  let bd = Infinity;
  for (const c of palette) {
    const dr = r - c[0];
    const dg = g - c[1];
    const db = b - c[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
