import type { EffectModule } from "../types";
import {
  boxBlur,
  buildNoiseField,
  maxFilterSeparable,
  minFilterSeparable,
} from "../utils";

export type EdgeBleedParams = {
  amount: number; // px — how far dark/light spreads into its opposite
  polarity: "spread-dark" | "spread-light";
  jitter: number; // 0..100 — per-pixel noise modulates the coverage, so the bleed is uneven
  scale: number; // noise feature size for the jitter
  // Blurs the spread buffer by `feather` px after the morphological pass,
  // so the outer boundary of the bleed fades softly into the original
  // instead of being a hard halo edge. 0 = old hard look.
  feather: number;
  seed: number;
  strength: number; // 0..100 — blend with the original
};

export const edgeBleed: EffectModule<"edgeBleed", EdgeBleedParams> = {
  kind: "edgeBleed",
  label: "Edge bleed",
  description: "ink spread · uneven",
  defaults: {
    amount: 3,
    polarity: "spread-dark",
    jitter: 60,
    scale: 10,
    feather: 2,
    seed: 1,
    strength: 100,
  },
  apply(img, p) {
    const r = Math.round(p.amount);
    if (r < 1 || p.strength <= 0) return img;
    const w = img.width;
    const h = img.height;
    const src = new Uint8ClampedArray(img.data);
    const spread = new Uint8ClampedArray(img.data);
    if (p.polarity === "spread-dark") {
      minFilterSeparable(spread, w, h, r);
    } else {
      maxFilterSeparable(spread, w, h, r);
    }
    const fr = Math.round(p.feather);
    if (fr > 0) boxBlur(spread, w, h, fr);
    const noise = p.jitter > 0 ? buildNoiseField(w, h, p.scale, 1, p.seed, 0) : null;
    const mix = p.strength / 100;
    const dst = img.data;
    for (let i = 0; i < dst.length; i += 4) {
      let coverage = 1;
      if (noise) {
        const n = noise[i >> 2] * 0.5 + 0.5;
        coverage = 1 - (1 - n) * (p.jitter / 100);
        if (coverage < 0) coverage = 0;
        else if (coverage > 1) coverage = 1;
      }
      for (let c = 0; c < 3; c++) {
        const orig = src[i + c];
        const blended = orig + (spread[i + c] - orig) * coverage;
        dst[i + c] = orig + (blended - orig) * mix;
      }
    }
    return img;
  },
  summarize: (p) =>
    `${p.amount}px · ${p.polarity === "spread-dark" ? "dark→" : "light→"} · j${p.jitter}`,
  // amount = spread radius (px), scale = noise feature size (px),
  // feather = post-blur (px). jitter/strength are %; seed is an integer.
  scaleParams: (p, s) => ({
    ...p,
    amount: p.amount * s,
    scale: p.scale * s,
    feather: p.feather * s,
  }),
};
