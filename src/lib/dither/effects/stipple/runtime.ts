import type { EffectModule } from "../types";
import { hashSigned, hexToRgb255 } from "../utils";

export type StippleParams = {
  density: number; // px between dot centers on the base grid
  minSize: number; // px — radius at lightest covered pixel
  maxSize: number; // px — radius at darkest pixel
  threshold: number; // 0..100 — ink amount below this gets no dot
  jitter: number; // 0..100 — % of cell size to randomly offset each dot
  inkColor: string;
  bgColor: string;
  bgEnabled: boolean;
  preserveColors: boolean;
  seed: number;
};

export const stipple: EffectModule<"stipple", StippleParams> = {
  kind: "stipple",
  label: "Stipple",
  description: "organic dots · density",
  defaults: {
    density: 7,
    minSize: 0.5,
    maxSize: 2.8,
    threshold: 5,
    jitter: 60,
    inkColor: "#111111",
    bgColor: "#f5f0e0",
    bgEnabled: true,
    preserveColors: false,
    seed: 1,
  },
  apply(img, p) {
    const w = img.width;
    const h = img.height;
    const src = new Uint8ClampedArray(img.data);
    const dst = img.data;

    if (p.bgEnabled) {
      const bg = hexToRgb255(p.bgColor);
      for (let i = 0; i < dst.length; i += 4) {
        dst[i] = bg[0];
        dst[i + 1] = bg[1];
        dst[i + 2] = bg[2];
      }
    }

    const ink = hexToRgb255(p.inkColor);
    const spacing = Math.max(1, Math.round(p.density));
    const jitterAmp = (p.jitter / 100) * spacing * 0.5;
    const tCut = p.threshold / 100;

    for (let gy = 0; gy < h; gy += spacing) {
      for (let gx = 0; gx < w; gx += spacing) {
        const cellIdx = (gy / spacing) * Math.ceil(w / spacing) + gx / spacing;
        const ox = hashSigned(p.seed, cellIdx * 2) * jitterAmp;
        const oy = hashSigned(p.seed, cellIdx * 2 + 1) * jitterAmp;
        const cx = Math.max(0, Math.min(w - 1, Math.round(gx + ox)));
        const cy = Math.max(0, Math.min(h - 1, Math.round(gy + oy)));
        const si = (cy * w + cx) * 4;
        const lum = (0.2126 * src[si] + 0.7152 * src[si + 1] + 0.0722 * src[si + 2]) / 255;
        const inkAmount = 1 - lum;
        if (inkAmount < tCut) continue;
        const radius = p.minSize + (p.maxSize - p.minSize) * inkAmount;
        const r2 = radius * radius;
        const rCeil = Math.ceil(radius);
        const colR = p.preserveColors ? src[si] : ink[0];
        const colG = p.preserveColors ? src[si + 1] : ink[1];
        const colB = p.preserveColors ? src[si + 2] : ink[2];
        const ymin = Math.max(0, cy - rCeil);
        const ymax = Math.min(h - 1, cy + rCeil);
        const xmin = Math.max(0, cx - rCeil);
        const xmax = Math.min(w - 1, cx + rCeil);
        for (let py = ymin; py <= ymax; py++) {
          const dy = py - cy;
          for (let px = xmin; px <= xmax; px++) {
            const dx = px - cx;
            const d2 = dx * dx + dy * dy;
            if (d2 > r2) continue;
            // Soft-edged dot for sub-pixel feel (linear falloff in the
            // last pixel of the radius). Without this the smallest dots
            // flicker.
            const edge = Math.max(0, 1 - (Math.sqrt(d2) - (radius - 1)));
            const a = Math.min(1, edge);
            const o = (py * w + px) * 4;
            dst[o] = dst[o] + (colR - dst[o]) * a;
            dst[o + 1] = dst[o + 1] + (colG - dst[o + 1]) * a;
            dst[o + 2] = dst[o + 2] + (colB - dst[o + 2]) * a;
          }
        }
      }
    }
    return img;
  },
  summarize: (p) =>
    `d${p.density} · ${p.minSize.toFixed(1)}–${p.maxSize.toFixed(1)}px · j${p.jitter}`,
  // density = grid pitch (px), minSize/maxSize = dot radii (px).
  // threshold and jitter are %; seed is an integer.
  scaleParams: (p, s) => ({
    ...p,
    density: p.density * s,
    minSize: p.minSize * s,
    maxSize: p.maxSize * s,
  }),
};
