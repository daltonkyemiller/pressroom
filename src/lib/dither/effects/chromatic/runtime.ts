import type { EffectModule } from "../types";

export type ChromaticParams = {
  amount: number; // px shift
  angle: number; // 0..360 — direction of the R/B split (ignored when radial)
  mode: "linear" | "radial";
};

export const chromatic: EffectModule<"chromatic", ChromaticParams> = {
  kind: "chromatic",
  label: "Chromatic shift",
  description: "rgb shift · print",
  defaults: { amount: 3, angle: 0, mode: "linear" },
  apply(img, p) {
    if (p.amount <= 0) return img;
    const w = img.width;
    const h = img.height;
    const src = new Uint8ClampedArray(img.data);
    const dst = img.data;
    if (p.mode === "linear") {
      const ang = (p.angle * Math.PI) / 180;
      const ox = Math.cos(ang) * p.amount;
      const oy = Math.sin(ang) * p.amount;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          const rx = Math.max(0, Math.min(w - 1, Math.round(x + ox)));
          const ry = Math.max(0, Math.min(h - 1, Math.round(y + oy)));
          const bx = Math.max(0, Math.min(w - 1, Math.round(x - ox)));
          const by = Math.max(0, Math.min(h - 1, Math.round(y - oy)));
          dst[o] = src[(ry * w + rx) * 4];
          dst[o + 1] = src[(y * w + x) * 4 + 1];
          dst[o + 2] = src[(by * w + bx) * 4 + 2];
        }
      }
    } else {
      const cx = w / 2;
      const cy = h / 2;
      const maxDist = Math.hypot(cx, cy) || 1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.hypot(dx, dy);
          const t = (dist / maxDist) * p.amount;
          const ux = dist > 0 ? dx / dist : 0;
          const uy = dist > 0 ? dy / dist : 0;
          const ox = ux * t;
          const oy = uy * t;
          const o = (y * w + x) * 4;
          const rx = Math.max(0, Math.min(w - 1, Math.round(x + ox)));
          const ry = Math.max(0, Math.min(h - 1, Math.round(y + oy)));
          const bx = Math.max(0, Math.min(w - 1, Math.round(x - ox)));
          const by = Math.max(0, Math.min(h - 1, Math.round(y - oy)));
          dst[o] = src[(ry * w + rx) * 4];
          dst[o + 1] = src[(y * w + x) * 4 + 1];
          dst[o + 2] = src[(by * w + bx) * 4 + 2];
        }
      }
    }
    return img;
  },
  summarize: (p) => `${p.amount}px · ${p.mode === "radial" ? "radial" : `${p.angle}°`}`,
  // amount = px shift between R and B channels.
  scaleParams: (p, s) => ({ ...p, amount: p.amount * s }),
};
