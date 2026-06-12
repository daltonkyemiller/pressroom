import { boxBlur } from "./effects/utils";

export type ProgressiveBlurDirection = "linear" | "radial";

export type ProgressiveBlurParams = {
  direction: ProgressiveBlurDirection;
  angle: number; // 0..360 — linear gradient direction (0 = →, 90 = ↓)
  start: number; // 0..100 — position where blur begins (mask ≤ start → no blur)
  end: number; // 0..100 — position where blur reaches max (mask ≥ end → max blur)
  maxRadius: number; // 0..40 px — peak blur radius
  curve: number; // 0.3..3 — easing exponent applied to the mask
  centerX: number; // 0..100 — radial center, % of width
  centerY: number; // 0..100 — radial center, % of height
  invert: boolean; // swap blurred/sharp regions
};

export const PROGRESSIVE_BLUR_DEFAULTS: ProgressiveBlurParams = {
  direction: "linear",
  angle: 90,
  start: 40,
  end: 100,
  maxRadius: 16,
  curve: 1,
  centerX: 50,
  centerY: 50,
  invert: false,
};

const LEVELS = 5;

export function applyProgressiveBlur(img: ImageData, p: ProgressiveBlurParams): ImageData {
  const w = img.width;
  const h = img.height;
  const maxR = Math.round(p.maxRadius);
  if (maxR < 1) return img;

  // Pre-blurred copies at radii 0, r/4, r/2, 3r/4, r.
  const mips: Uint8ClampedArray[] = new Array(LEVELS);
  mips[0] = new Uint8ClampedArray(img.data);
  for (let i = 1; i < LEVELS; i++) {
    const r = Math.max(1, Math.round((maxR * i) / (LEVELS - 1)));
    const copy = new Uint8ClampedArray(img.data);
    boxBlur(copy, w, h, r);
    mips[i] = copy;
  }

  const out = img.data;
  const isLinear = p.direction === "linear";
  const ang = (p.angle * Math.PI) / 180;
  const dirX = Math.cos(ang);
  const dirY = Math.sin(ang);

  // Normalize linear projection so the mask spans 0..1 across the image extent
  // along the chosen direction (corners give the bounds).
  let minProj = 0;
  let projRange = 1;
  if (isLinear) {
    let minP = Infinity;
    let maxP = -Infinity;
    for (const [x, y] of [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ]) {
      const proj = x * dirX + y * dirY;
      if (proj < minP) minP = proj;
      if (proj > maxP) maxP = proj;
    }
    minProj = minP;
    projRange = maxP - minP || 1;
  }

  const cx = (p.centerX / 100) * w;
  const cy = (p.centerY / 100) * h;
  // Radial scale: furthest corner from center → mask = 1.
  const maxDist =
    Math.max(
      Math.hypot(cx, cy),
      Math.hypot(w - cx, cy),
      Math.hypot(cx, h - cy),
      Math.hypot(w - cx, h - cy),
    ) || 1;

  const start = p.start / 100;
  const end = p.end / 100;
  const span = end - start || 0.0001;
  const curve = p.curve;
  const invert = p.invert;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let t: number;
      if (isLinear) {
        t = (x * dirX + y * dirY - minProj) / projRange;
      } else {
        t = Math.hypot(x - cx, y - cy) / maxDist;
      }
      let m = (t - start) / span;
      if (m < 0) m = 0;
      else if (m > 1) m = 1;
      if (curve !== 1) m = Math.pow(m, curve);
      if (invert) m = 1 - m;

      const level = m * (LEVELS - 1);
      const li = Math.min(LEVELS - 2, Math.floor(level));
      const lf = level - li;
      const lo = mips[li];
      const hi = mips[li + 1];
      const idx = (y * w + x) * 4;
      out[idx] = lo[idx] + (hi[idx] - lo[idx]) * lf;
      out[idx + 1] = lo[idx + 1] + (hi[idx + 1] - lo[idx + 1]) * lf;
      out[idx + 2] = lo[idx + 2] + (hi[idx + 2] - lo[idx + 2]) * lf;
    }
  }
  return img;
}
