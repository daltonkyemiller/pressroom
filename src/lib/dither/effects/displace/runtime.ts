import type { EffectModule } from "../types";
import { buildNoiseField } from "../utils";

export type DisplaceParams = {
  amount: number; // max pixel offset
  scale: number; // 1..200 — noise cell size in px (small = grainy/inky, large = wavy/watercolor)
  octaves: number; // 1..4 — number of overlaid noise frequencies for richness
  seed: number;
  // 0..100 — interpolates between the original and the displaced output.
  strength: number;
};

export const displace: EffectModule<"displace", DisplaceParams> = {
  kind: "displace",
  label: "Displace",
  description: "noise warp · ink bleed",
  defaults: { amount: 3, scale: 8, octaves: 2, seed: 1, strength: 100 },
  apply(img, p) {
    if (p.amount <= 0 || p.strength <= 0) return img;
    const w = img.width;
    const h = img.height;
    const src = new Uint8ClampedArray(img.data);
    const dst = img.data;
    const nx = buildNoiseField(w, h, p.scale, p.octaves, p.seed, 0);
    const ny = buildNoiseField(w, h, p.scale, p.octaves, p.seed, 1);
    const mix = p.strength / 100;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const sx = x + nx[i] * p.amount;
        const sy = y + ny[i] * p.amount;
        const x0 = Math.max(0, Math.min(w - 1, Math.floor(sx)));
        const y0 = Math.max(0, Math.min(h - 1, Math.floor(sy)));
        const x1 = Math.max(0, Math.min(w - 1, x0 + 1));
        const y1 = Math.max(0, Math.min(h - 1, y0 + 1));
        const fx = sx - Math.floor(sx);
        const fy = sy - Math.floor(sy);
        const o = i * 4;
        for (let c = 0; c < 3; c++) {
          const a = src[(y0 * w + x0) * 4 + c];
          const b = src[(y0 * w + x1) * 4 + c];
          const cc = src[(y1 * w + x0) * 4 + c];
          const d = src[(y1 * w + x1) * 4 + c];
          const top = a + (b - a) * fx;
          const bot = cc + (d - cc) * fx;
          const v = top + (bot - top) * fy;
          dst[o + c] = src[o + c] + (v - src[o + c]) * mix;
        }
      }
    }
    return img;
  },
  summarize: (p) => `${p.amount}px · scale ${p.scale} · oct ${p.octaves}`,
  // amount = max displacement (px), scale = noise cell size (px).
  // octaves and seed are integer counts; strength is %.
  scaleParams: (p, s) => ({ ...p, amount: p.amount * s, scale: p.scale * s }),
};
