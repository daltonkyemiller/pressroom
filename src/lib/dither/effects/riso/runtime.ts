import type { EffectModule } from "../types";
import { hash, hexToRgb255 } from "../utils";

export type RisoParams = {
  ink1Color: string;
  ink2Color: string;
  paperColor: string;
  // 0..100. Pixels with luminance below threshold1 get ink1; below
  // threshold2 get ink2. threshold2 should typically be lower than
  // threshold1 so ink2 covers a smaller subset (the deepest shadows).
  threshold1: number;
  threshold2: number;
  // Softness of the threshold ramp (0 = hard step, 1 = wide feather).
  softness: number;
  // Per-ink misregistration — sample offset before computing coverage.
  offset1: number;
  angle1: number;
  offset2: number;
  angle2: number;
  // Per-ink grain — random erosion of the ink coverage.
  grain1: number;
  grain2: number;
  seed: number;
};

export const riso: EffectModule<"riso", RisoParams> = {
  kind: "riso",
  label: "Risograph",
  description: "2-ink screen · misregister",
  defaults: {
    ink1Color: "#ff4a3d",
    ink2Color: "#1c1c2e",
    paperColor: "#f4ecd8",
    threshold1: 70,
    threshold2: 35,
    softness: 0.18,
    offset1: 0,
    angle1: 0,
    offset2: 2,
    angle2: 135,
    grain1: 25,
    grain2: 35,
    seed: 1,
  },
  apply(img, p) {
    const w = img.width;
    const h = img.height;
    const src = new Uint8ClampedArray(img.data);
    const dst = img.data;
    const paper = hexToRgb255(p.paperColor);
    const ink1 = hexToRgb255(p.ink1Color);
    const ink2 = hexToRgb255(p.ink2Color);

    const a1 = (p.angle1 * Math.PI) / 180;
    const a2 = (p.angle2 * Math.PI) / 180;
    const o1x = Math.cos(a1) * p.offset1;
    const o1y = Math.sin(a1) * p.offset1;
    const o2x = Math.cos(a2) * p.offset2;
    const o2y = Math.sin(a2) * p.offset2;

    const t1 = p.threshold1 / 100;
    const t2 = p.threshold2 / 100;
    const ramp = Math.max(0.001, p.softness);

    const coverage = (L: number, cutoff: number): number => {
      const v = (cutoff - L) / ramp;
      if (v <= 0) return 0;
      if (v >= 1) return 1;
      return v;
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const x1 = Math.max(0, Math.min(w - 1, Math.round(x + o1x)));
        const y1 = Math.max(0, Math.min(h - 1, Math.round(y + o1y)));
        const x2 = Math.max(0, Math.min(w - 1, Math.round(x + o2x)));
        const y2 = Math.max(0, Math.min(h - 1, Math.round(y + o2y)));
        const i1 = (y1 * w + x1) * 4;
        const i2 = (y2 * w + x2) * 4;
        const L1 = (0.2126 * src[i1] + 0.7152 * src[i1 + 1] + 0.0722 * src[i1 + 2]) / 255;
        const L2 = (0.2126 * src[i2] + 0.7152 * src[i2 + 1] + 0.0722 * src[i2 + 2]) / 255;

        let c1 = coverage(L1, t1);
        let c2 = coverage(L2, t2);

        if (p.grain1 > 0) {
          const n = hash(p.seed, o) * 2;
          c1 *= Math.max(0, 1 - n * (p.grain1 / 100));
        }
        if (p.grain2 > 0) {
          const n = hash(p.seed + 31, o) * 2;
          c2 *= Math.max(0, 1 - n * (p.grain2 / 100));
        }
        if (c1 < 0) c1 = 0;
        else if (c1 > 1) c1 = 1;
        if (c2 < 0) c2 = 0;
        else if (c2 > 1) c2 = 1;

        // Subtractive ink mix on paper. Each ink absorbs its complement
        // of light; overlapping inks multiply absorption.
        const m1r = 1 - c1 * (1 - ink1[0] / 255);
        const m1g = 1 - c1 * (1 - ink1[1] / 255);
        const m1b = 1 - c1 * (1 - ink1[2] / 255);
        const m2r = 1 - c2 * (1 - ink2[0] / 255);
        const m2g = 1 - c2 * (1 - ink2[1] / 255);
        const m2b = 1 - c2 * (1 - ink2[2] / 255);
        dst[o] = paper[0] * m1r * m2r;
        dst[o + 1] = paper[1] * m1g * m2g;
        dst[o + 2] = paper[2] * m1b * m2b;
      }
    }
    return img;
  },
  summarize: (p) =>
    `t${p.threshold1}/${p.threshold2} · off ${p.offset2}px · g${p.grain1}/${p.grain2}`,
};
