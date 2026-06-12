import type { EffectModule } from "../types";
import { buildNoiseField, hexToRgb255 } from "../utils";

export type TextParams = {
  content: string;
  font: string;
  size: number;
  letterSpacing: number;
  lineHeight: number;
  align: "left" | "center" | "right";
  vAlign: "top" | "middle" | "bottom";
  bold: boolean;
  italic: boolean;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  opacity: number;
  blur: number;
  dilate: number;
  displace: number;
  displaceScale: number;
  dust: number;
  dustScale: number;
  threshold: number;
  thresholdSoftness: number;
  seed: number;
};

// Rasterizes the user's text to an alpha mask in an offscreen canvas, runs a
// bleed pipeline (blur → dilate → displace → dust → soft re-threshold), then
// composites the chosen ink color over the source using the resulting mask.
function rasterizeTextMask(p: TextParams, w: number, h: number): Uint8ClampedArray {
  const cvs = new OffscreenCanvas(w, h);
  const ctx = cvs.getContext("2d");
  if (!ctx) return new Uint8ClampedArray(w * h);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  const style = p.italic ? "italic " : "";
  const weight = p.bold ? "700 " : "400 ";
  ctx.font = `${style}${weight}${p.size}px "${p.font.replace(/"/g, "")}", system-ui, sans-serif`;
  ctx.textAlign = p.align as CanvasTextAlign;
  ctx.textBaseline = "middle";
  if ("letterSpacing" in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${p.letterSpacing}px`;
  }
  const ax = (p.x / 100) * w;
  const ay = (p.y / 100) * h;
  ctx.translate(ax, ay);
  ctx.rotate((p.rotation * Math.PI) / 180);
  const s = p.scale / 100;
  ctx.scale(s, s);
  const lines = p.content.split("\n");
  const lineH = p.size * Math.max(0.1, p.lineHeight);
  const n = lines.length;
  let firstY: number;
  if (p.vAlign === "top") firstY = lineH / 2;
  else if (p.vAlign === "bottom") firstY = -lineH / 2 - (n - 1) * lineH;
  else firstY = -((n - 1) * lineH) / 2;
  for (let i = 0; i < n; i++) {
    ctx.fillText(lines[i], 0, firstY + i * lineH);
  }
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 3; i < mask.length; i++, j += 4) mask[i] = rgba[j];
  return mask;
}

function blurMask(mask: Uint8ClampedArray, w: number, h: number, r: number) {
  if (r < 1) return;
  const passes = 3;
  for (let pass = 0; pass < passes; pass++) {
    const tmp = new Uint8ClampedArray(mask.length);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const xi = Math.max(0, Math.min(w - 1, i));
        sum += mask[y * w + xi];
      }
      const div = r * 2 + 1;
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / div;
        const x1 = Math.max(0, x - r);
        const x2 = Math.min(w - 1, x + r + 1);
        sum += mask[y * w + x2] - mask[y * w + x1];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const yi = Math.max(0, Math.min(h - 1, i));
        sum += tmp[yi * w + x];
      }
      const div = r * 2 + 1;
      for (let y = 0; y < h; y++) {
        mask[y * w + x] = sum / div;
        const y1 = Math.max(0, y - r);
        const y2 = Math.min(h - 1, y + r + 1);
        sum += tmp[y2 * w + x] - tmp[y1 * w + x];
      }
    }
  }
}

function dilateMask(mask: Uint8ClampedArray, w: number, h: number, r: number) {
  if (r < 1) return;
  const tmp = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      const lo = Math.max(0, x - r);
      const hi = Math.min(w - 1, x + r);
      for (let xi = lo; xi <= hi; xi++) {
        const v = mask[y * w + xi];
        if (v > m) m = v;
      }
      tmp[y * w + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 0;
      const lo = Math.max(0, y - r);
      const hi = Math.min(h - 1, y + r);
      for (let yi = lo; yi <= hi; yi++) {
        const v = tmp[yi * w + x];
        if (v > m) m = v;
      }
      mask[y * w + x] = m;
    }
  }
}

function displaceMask(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  amount: number,
  scale: number,
  seed: number,
) {
  if (amount <= 0) return;
  const nx = buildNoiseField(w, h, scale, 2, seed, 0);
  const ny = buildNoiseField(w, h, scale, 2, seed, 1);
  const src = new Uint8ClampedArray(mask);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const sx = x + nx[i] * amount;
      const sy = y + ny[i] * amount;
      const x0 = Math.max(0, Math.min(w - 1, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(h - 1, Math.floor(sy)));
      const x1 = Math.max(0, Math.min(w - 1, x0 + 1));
      const y1 = Math.max(0, Math.min(h - 1, y0 + 1));
      const fx = sx - Math.floor(sx);
      const fy = sy - Math.floor(sy);
      const a = src[y0 * w + x0];
      const b = src[y0 * w + x1];
      const c = src[y1 * w + x0];
      const d = src[y1 * w + x1];
      const top = a + (b - a) * fx;
      const bot = c + (d - c) * fx;
      mask[i] = top + (bot - top) * fy;
    }
  }
}

function dustMask(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  dust: number,
  scale: number,
  seed: number,
) {
  if (dust <= 0) return;
  const noise = buildNoiseField(w, h, Math.max(1, scale), 2, seed + 23, 2);
  const cutoff = (dust / 100) * 2 - 1;
  for (let i = 0; i < mask.length; i++) {
    if (noise[i] < cutoff) mask[i] = 0;
  }
}

export const text: EffectModule<"text", TextParams> = {
  kind: "text",
  label: "Text",
  description: "typography · bleed",
  defaults: {
    content: "INK",
    font: "Mondwest",
    size: 200,
    letterSpacing: 0,
    lineHeight: 1.1,
    align: "center",
    vAlign: "middle",
    bold: false,
    italic: false,
    x: 50,
    y: 50,
    rotation: 0,
    scale: 100,
    color: "#0a0a0a",
    opacity: 1,
    blur: 1.5,
    dilate: 1,
    displace: 2,
    displaceScale: 6,
    dust: 30,
    dustScale: 3,
    threshold: 140,
    thresholdSoftness: 0.15,
    seed: 1,
  },
  apply(img, p) {
    const w = img.width;
    const h = img.height;
    const mask = rasterizeTextMask(p, w, h);

    if (p.blur > 0) blurMask(mask, w, h, Math.round(p.blur));
    if (p.dilate > 0) dilateMask(mask, w, h, Math.round(p.dilate));
    if (p.displace > 0) displaceMask(mask, w, h, p.displace, p.displaceScale, p.seed);
    if (p.dust > 0) dustMask(mask, w, h, p.dust, p.dustScale, p.seed);

    // Re-binarize through a soft threshold so the result reads as ink rather
    // than a feathered glow. softness=0 → hard step.
    const t = p.threshold;
    const ramp = Math.max(1, p.thresholdSoftness * 255);
    const lo = t - ramp / 2;
    const hi = t + ramp / 2;
    for (let i = 0; i < mask.length; i++) {
      const v = mask[i];
      if (v <= lo) mask[i] = 0;
      else if (v >= hi) mask[i] = 255;
      else mask[i] = Math.round(((v - lo) / ramp) * 255);
    }

    const ink = hexToRgb255(p.color);
    const data = img.data;
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const m = mask[j];
      if (m === 0) continue;
      const a = (m / 255) * p.opacity;
      data[i] = data[i] + (ink[0] - data[i]) * a;
      data[i + 1] = data[i + 1] + (ink[1] - data[i + 1]) * a;
      data[i + 2] = data[i + 2] + (ink[2] - data[i + 2]) * a;
    }
    return img;
  },
  summarize: (p) => {
    const trimmed = p.content.length > 14 ? `${p.content.slice(0, 14)}…` : p.content;
    return `"${trimmed}" · ${p.size}px`;
  },
  // Almost everything here is px-dimensioned (the glyph metrics, the
  // bleed pipeline kernels). x/y are %-of-canvas, rotation is degrees,
  // scale is a multiplier, opacity/threshold/thresholdSoftness are
  // intensities, content/font/align/vAlign/bold/italic/color/seed are
  // discrete or color values — none of those scale.
  scaleParams: (p, s) => ({
    ...p,
    size: p.size * s,
    letterSpacing: p.letterSpacing * s,
    blur: p.blur * s,
    dilate: p.dilate * s,
    displace: p.displace * s,
    displaceScale: p.displaceScale * s,
    dustScale: p.dustScale * s,
  }),
};
