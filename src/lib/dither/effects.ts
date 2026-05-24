import { BAYER4, BAYER8, KERNELS } from "./kernels";
import { PALETTES, nearestColor, type PaletteId } from "./palettes";
import { applyDuotoneShader, DUOTONE_DEFAULTS, type DuotoneParams } from "./shader-duotone";
import { applyGrain, GRAIN_DEFAULTS, type GrainParams } from "./grain";
import {
  applyCurves,
  CURVES_DEFAULTS,
  isIdentityCurve,
  type CurveChannel,
  type CurvesParams,
} from "./curves";
import {
  applyProgressiveBlur,
  PROGRESSIVE_BLUR_DEFAULTS,
  type ProgressiveBlurParams,
} from "./progressive-blur";
import { isGpuAvailable, runGpuChain, type GpuChainItem, type GpuEffect } from "./gpu/runner";
import { colorGpu } from "./gpu/effects/color";
import { curvesGpu } from "./gpu/effects/curves";

export type EffectKind =
  | "blur"
  | "progressiveBlur"
  | "color"
  | "curves"
  | "halftone"
  | "dither"
  | "invert"
  | "noise"
  | "grain"
  | "displace"
  | "chromatic"
  | "edgeBleed"
  | "duotone";

export type BlurParams = { radius: number };
export type ColorParams = { contrast: number; brightness: number; gamma: number; saturation: number };
export type HalftoneShape = "dot" | "line" | "cross" | "square";
export type HalftoneParams = {
  size: number;
  angle: number;
  shape: HalftoneShape;
  palette: PaletteId;
  goo: number;
  spread: number;
  preserveColors: boolean;
};
export type DitherAlgo =
  | "floyd"
  | "atkinson"
  | "burkes"
  | "sierra"
  | "stucki"
  | "bayer4"
  | "bayer8"
  | "threshold";
export type DitherParams = {
  algo: DitherAlgo;
  palette: PaletteId;
  serpentine: boolean;
  preserveColors: boolean;
  strength: number; // 0..100 — blend dithered output back with original
  preBlur: number; // 0..5 px — soften input before dithering
  diffusion: number; // 0..200 % — scales error diffusion (error-diffusion algos)
  matrixScale: number; // 16..128 — Bayer matrix amplitude
  jitter: number; // 0..100 — per-pixel deterministic random offset
  inkColor: string; // hex — ink shade when preserveColors is on
  preserveTransparency: boolean; // skip alpha=0 pixels: no quantize, no error diffusion in/out
};
export type InvertParams = Record<string, never>;
export type NoiseParams = { amount: number };
export type DisplaceParams = {
  amount: number; // max pixel offset
  scale: number; // 1..200 — noise cell size in px (small = grainy/inky, large = wavy/watercolor)
  octaves: number; // 1..4 — number of overlaid noise frequencies for richness
  seed: number;
  // 0..100 — interpolates between the original and the displaced output.
  // Useful for "subtle bleed at edges" without softening the whole image.
  strength: number;
};
export type EdgeBleedParams = {
  amount: number; // px — how far dark/light spreads into its opposite
  polarity: "spread-dark" | "spread-light"; // spread-dark = dilate dark areas (ink bleeding into paper); spread-light = erode dark (paper eating ink)
  jitter: number; // 0..100 — per-pixel noise modulates the coverage, so the bleed is uneven instead of a uniform halo
  scale: number; // noise feature size for the jitter
  // Blurs the spread buffer by `feather` px after the morphological pass,
  // so the outer boundary of the bleed fades softly into the original
  // instead of being a hard halo edge. 0 = old hard look.
  feather: number;
  seed: number;
  strength: number; // 0..100 — blend with the original
};
export type ChromaticParams = {
  amount: number; // px shift
  angle: number; // 0..360 — direction of the R/B split (ignored when radial)
  mode: "linear" | "radial";
};

export type ParamsByKind = {
  blur: BlurParams;
  progressiveBlur: ProgressiveBlurParams;
  color: ColorParams;
  curves: CurvesParams;
  halftone: HalftoneParams;
  dither: DitherParams;
  invert: InvertParams;
  noise: NoiseParams;
  grain: GrainParams;
  displace: DisplaceParams;
  chromatic: ChromaticParams;
  edgeBleed: EdgeBleedParams;
  duotone: DuotoneParams;
};

export type Layer = {
  [K in EffectKind]: {
    id: number;
    kind: K;
    enabled: boolean;
    expanded: boolean;
    params: ParamsByKind[K];
  };
}[EffectKind];

export const EFFECT_DEFAULTS: { [K in EffectKind]: ParamsByKind[K] } = {
  blur: { radius: 2 },
  progressiveBlur: PROGRESSIVE_BLUR_DEFAULTS,
  color: { contrast: 0, brightness: 0, gamma: 1, saturation: 100 },
  curves: CURVES_DEFAULTS,
  halftone: {
    size: 8,
    angle: 45,
    shape: "dot",
    palette: "bw",
    goo: 0,
    spread: 100,
    preserveColors: false,
  },
  dither: {
    algo: "floyd",
    palette: "bw",
    serpentine: true,
    preserveColors: false,
    strength: 100,
    preBlur: 0,
    diffusion: 100,
    matrixScale: 64,
    jitter: 0,
    inkColor: "#000000",
    preserveTransparency: false,
  },
  invert: {},
  noise: { amount: 20 },
  grain: GRAIN_DEFAULTS,
  displace: { amount: 3, scale: 8, octaves: 2, seed: 1, strength: 100 },
  chromatic: { amount: 3, angle: 0, mode: "linear" },
  edgeBleed: {
    amount: 3,
    polarity: "spread-dark",
    jitter: 60,
    scale: 10,
    feather: 2,
    seed: 1,
    strength: 100,
  },
  duotone: DUOTONE_DEFAULTS,
};

export const EFFECT_LABELS: Record<EffectKind, string> = {
  blur: "Blur",
  progressiveBlur: "Progressive blur",
  color: "Color adjust",
  curves: "Curves",
  halftone: "Halftone",
  dither: "Dither",
  invert: "Invert",
  noise: "Noise",
  grain: "Grain",
  displace: "Displace",
  chromatic: "Chromatic shift",
  edgeBleed: "Edge bleed",
  duotone: "Duotone dashes",
};

export const EFFECT_DESCRIPTIONS: Record<EffectKind, string> = {
  blur: "soften input",
  progressiveBlur: "gradient · radial",
  color: "contrast · gamma",
  curves: "tonal map · per channel",
  halftone: "dot tone",
  dither: "8 algorithms",
  invert: "flip values",
  noise: "uniform grain",
  grain: "film · tonal response",
  displace: "noise warp · ink bleed",
  chromatic: "rgb shift · print",
  edgeBleed: "ink spread · uneven",
  duotone: "shader · capsule grid",
};

// ---------- DITHER KERNELS (flat) ----------
type FlatKernel = { dx: Int8Array; dy: Int8Array; factor: Float32Array };
const FLAT_KERNEL_CACHE = new Map<string, FlatKernel>();
function getFlatKernel(name: string): FlatKernel {
  const cached = FLAT_KERNEL_CACHE.get(name);
  if (cached) return cached;
  const k = KERNELS[name];
  const n = k.weights.length;
  const dx = new Int8Array(n);
  const dy = new Int8Array(n);
  const factor = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    dx[i] = k.weights[i][0];
    dy[i] = k.weights[i][1];
    factor[i] = k.weights[i][2] / k.denom;
  }
  const flat: FlatKernel = { dx, dy, factor };
  FLAT_KERNEL_CACHE.set(name, flat);
  return flat;
}

// ---------- BLUR ----------
export function boxBlur(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
  channels: 3 | 4 = 3,
) {
  if (r < 1) return;
  const tmp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < channels; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const xi = Math.max(0, Math.min(w - 1, i));
        sum += data[(y * w + xi) * 4 + c];
      }
      const div = r * 2 + 1;
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = sum / div;
        const x1 = Math.max(0, x - r);
        const x2 = Math.min(w - 1, x + r + 1);
        sum += data[(y * w + x2) * 4 + c] - data[(y * w + x1) * 4 + c];
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const yi = Math.max(0, Math.min(h - 1, i));
        sum += tmp[(yi * w + x) * 4 + c];
      }
      const div = r * 2 + 1;
      for (let y = 0; y < h; y++) {
        data[(y * w + x) * 4 + c] = sum / div;
        const y1 = Math.max(0, y - r);
        const y2 = Math.min(h - 1, y + r + 1);
        sum += tmp[(y2 * w + x) * 4 + c] - tmp[(y1 * w + x) * 4 + c];
      }
    }
  }
}

function applyBlur(img: ImageData, p: BlurParams): ImageData {
  boxBlur(img.data, img.width, img.height, p.radius);
  return img;
}

// ---------- COLOR ----------
function applyColor(img: ImageData, p: ColorParams): ImageData {
  const data = img.data;
  const c = p.contrast / 100;
  const cFactor = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));
  const b = p.brightness;
  const g = p.gamma;
  const s = p.saturation / 100;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let gr = data[i + 1];
    let bl = data[i + 2];
    r = cFactor * (r + b - 128) + 128;
    gr = cFactor * (gr + b - 128) + 128;
    bl = cFactor * (bl + b - 128) + 128;
    r = 255 * Math.pow(Math.max(0, r) / 255, 1 / g);
    gr = 255 * Math.pow(Math.max(0, gr) / 255, 1 / g);
    bl = 255 * Math.pow(Math.max(0, bl) / 255, 1 / g);
    if (s !== 1) {
      const L = 0.2126 * r + 0.7152 * gr + 0.0722 * bl;
      r = L + (r - L) * s;
      gr = L + (gr - L) * s;
      bl = L + (bl - L) * s;
    }
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, gr));
    data[i + 2] = Math.max(0, Math.min(255, bl));
  }
  return img;
}

function hexToRgb255(hex: string): [number, number, number] {
  const clean = (hex || "").replace("#", "");
  const full = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean;
  const n = Number.parseInt(full || "0", 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// ---------- HALFTONE ----------
function applyHalftone(img: ImageData, p: HalftoneParams): ImageData {
  const w = img.width;
  const h = img.height;
  const src = img.data;
  const palette = PALETTES[p.palette];

  let lightest = palette[0];
  let darkest = palette[0];
  let lL = -1;
  let dL = 256;
  for (const c of palette) {
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    if (L > lL) {
      lL = L;
      lightest = c;
    }
    if (L < dL) {
      dL = L;
      darkest = c;
    }
  }

  const shapes = new OffscreenCanvas(w, h);
  const sctx = shapes.getContext("2d")!;
  if (!p.preserveColors) {
    sctx.fillStyle = `rgb(${darkest[0]},${darkest[1]},${darkest[2]})`;
  }

  const size = p.size;
  const spread = (p.spread || 100) / 100;
  const angle = (p.angle * Math.PI) / 180;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const diag = Math.ceil(Math.sqrt(w * w + h * h));
  const steps = Math.ceil(diag / size) + 2;
  const cx = w / 2;
  const cy = h / 2;

  for (let gy = -steps; gy <= steps; gy++) {
    for (let gx = -steps; gx <= steps; gx++) {
      const rx = gx * size;
      const ry = gy * size;
      const x = cosA * rx - sinA * ry + cx;
      const y = sinA * rx + cosA * ry + cy;
      if (x < -size || x > w + size || y < -size || y > h + size) continue;

      const sx = Math.max(0, Math.min(w - 1, Math.floor(x)));
      const sy = Math.max(0, Math.min(h - 1, Math.floor(y)));
      const i = (sy * w + sx) * 4;
      const L = (0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]) / 255;
      const ink = 1 - L;
      if (ink < 0.02) continue;

      if (p.preserveColors) {
        sctx.fillStyle = `rgb(${src[i]},${src[i + 1]},${src[i + 2]})`;
      }

      if (p.shape === "dot") {
        const r = size * 0.55 * spread * Math.sqrt(ink);
        sctx.beginPath();
        sctx.arc(x, y, r, 0, Math.PI * 2);
        sctx.fill();
      } else if (p.shape === "square") {
        const s = size * spread * Math.sqrt(ink);
        sctx.save();
        sctx.translate(x, y);
        sctx.rotate(angle);
        sctx.fillRect(-s / 2, -s / 2, s, s);
        sctx.restore();
      } else if (p.shape === "line") {
        const len = size * 1.1 * spread;
        const thick = size * ink * spread;
        sctx.save();
        sctx.translate(x, y);
        sctx.rotate(angle);
        sctx.fillRect(-len / 2, -thick / 2, len, thick);
        sctx.restore();
      } else if (p.shape === "cross") {
        const len = size * 0.9 * spread;
        const thick = size * 0.5 * ink * spread;
        sctx.save();
        sctx.translate(x, y);
        sctx.rotate(angle);
        sctx.fillRect(-len / 2, -thick / 2, len, thick);
        sctx.fillRect(-thick / 2, -len / 2, thick, len);
        sctx.restore();
      }
    }
  }

  let inkLayer: OffscreenCanvas = shapes;
  if (p.goo > 0) {
    // Replaces the old SVG goo (gaussian blur + alpha threshold matrix). Three
    // box passes approximate gaussian; alpha is then snapped via the same
    // linear ramp the SVG matrix used (a' = 20a - 9 in 0..1 space).
    const blurAmount = (p.goo / 30) * (size * 0.6);
    const r = Math.max(1, Math.round(blurAmount));
    const gImg = sctx.getImageData(0, 0, w, h);
    const gd = gImg.data;
    boxBlur(gd, w, h, r, 4);
    boxBlur(gd, w, h, r, 4);
    boxBlur(gd, w, h, r, 4);
    for (let i = 3; i < gd.length; i += 4) {
      const t = 20 * gd[i] - 9 * 255;
      gd[i] = t < 0 ? 0 : t > 255 ? 255 : t;
    }
    const gooed = new OffscreenCanvas(w, h);
    gooed.getContext("2d")!.putImageData(gImg, 0, 0);
    inkLayer = gooed;
  }

  const out = new OffscreenCanvas(w, h);
  const octx = out.getContext("2d")!;
  if (p.preserveColors) {
    octx.fillStyle = "rgb(255,255,255)";
  } else {
    octx.fillStyle = `rgb(${lightest[0]},${lightest[1]},${lightest[2]})`;
  }
  octx.fillRect(0, 0, w, h);
  octx.drawImage(inkLayer, 0, 0);

  return octx.getImageData(0, 0, w, h);
}

// ---------- DITHER ----------
function applyDither(img: ImageData, p: DitherParams): ImageData {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const userPalette = PALETTES[p.palette];
  const algo = p.algo;
  const skipAlpha = p.preserveTransparency;

  // Snapshot of original RGBA before pre-blur. Used at the end to restore
  // alpha=0 pixels so they're byte-identical to the input.
  const origRGBA = skipAlpha ? new Uint8ClampedArray(data) : null;

  // Snapshot for the strength-blend at the very end (when < 100).
  const blendMix = Math.max(0, Math.min(1, p.strength / 100));
  const preStrength = blendMix < 1 ? new Uint8ClampedArray(data) : null;

  // Optional input pre-blur (separable box blur).
  if (p.preBlur > 0) boxBlur(data, w, h, Math.round(p.preBlur));

  // In preserveColors mode we dither against pure b&w to get a clean
  // binary mask, then swap the "white" pixels back to the original RGB.
  // The "dark" pixels use the darkest color from the user's palette
  // so the palette picker still controls the ink shade.
  const bwPalette = PALETTES.bw;
  const palette = p.preserveColors ? bwPalette : userPalette;
  let darkest: readonly [number, number, number] = userPalette[0];
  let original: Uint8ClampedArray | null = null;
  if (p.preserveColors) {
    original = new Uint8ClampedArray(data);
    darkest = hexToRgb255(p.inkColor ?? "#000000");
  }

  // Cheap deterministic per-pixel hash → ±jitterAmp in 0..255 space.
  const jitterAmp = (p.jitter / 100) * 64;
  const jitterAt = (x: number, y: number) => {
    if (jitterAmp <= 0) return 0;
    let n = ((x * 374761393) ^ (y * 668265263)) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n / 0xffffffff - 0.5) * 2 * jitterAmp;
  };

  if (algo in KERNELS) {
    const buf = new Float32Array(w * h * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      buf[j] = data[i];
      buf[j + 1] = data[i + 1];
      buf[j + 2] = data[i + 2];
    }
    // Flat typed-array kernel — avoids the per-pixel `for-of` over a 2-D
    // array (which V8 doesn't always inline) and bakes weight/denom into a
    // single Float32 factor.
    const flat = getFlatKernel(algo);
    const kdx = flat.dx;
    const kdy = flat.dy;
    const kf = flat.factor;
    const kn = kdx.length;
    const serp = p.serpentine;
    const diffMul = p.diffusion / 100;
    for (let y = 0; y < h; y++) {
      const reverse = serp && y % 2 === 1;
      const xStart = reverse ? w - 1 : 0;
      const xEnd = reverse ? -1 : w;
      const xStep = reverse ? -1 : 1;
      for (let x = xStart; x !== xEnd; x += xStep) {
        if (skipAlpha && data[(y * w + x) * 4 + 3] === 0) continue;
        const idx = (y * w + x) * 3;
        const j = jitterAt(x, y);
        const r = buf[idx] + j;
        const g = buf[idx + 1] + j;
        const b = buf[idx + 2] + j;
        const [nr, ng, nb] = nearestColor(r, g, b, palette);
        buf[idx] = nr;
        buf[idx + 1] = ng;
        buf[idx + 2] = nb;
        const er = (r - nr) * diffMul;
        const eg = (g - ng) * diffMul;
        const eb = (b - nb) * diffMul;
        for (let k = 0; k < kn; k++) {
          const dx = kdx[k];
          const dy = kdy[k];
          const ax = reverse ? x - dx : x + dx;
          const ay = y + dy;
          if (ax < 0 || ax >= w || ay >= h) continue;
          if (skipAlpha && data[(ay * w + ax) * 4 + 3] === 0) continue;
          const aidx = (ay * w + ax) * 3;
          const f = kf[k];
          buf[aidx] += er * f;
          buf[aidx + 1] += eg * f;
          buf[aidx + 2] += eb * f;
        }
      }
    }
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      data[i] = buf[j];
      data[i + 1] = buf[j + 1];
      data[i + 2] = buf[j + 2];
    }
  } else if (algo === "bayer4" || algo === "bayer8") {
    const matrix = algo === "bayer4" ? BAYER4 : BAYER8;
    const N = matrix.length;
    const strength = p.matrixScale;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (skipAlpha && data[idx + 3] === 0) continue;
        const t = matrix[y % N][x % N] * strength + jitterAt(x, y);
        const [nr, ng, nb] = nearestColor(
          data[idx] + t,
          data[idx + 1] + t,
          data[idx + 2] + t,
          palette,
        );
        data[idx] = nr;
        data[idx + 1] = ng;
        data[idx + 2] = nb;
      }
    }
  } else if (algo === "threshold") {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (skipAlpha && data[i + 3] === 0) continue;
        const j = jitterAt(x, y);
        const [nr, ng, nb] = nearestColor(data[i] + j, data[i + 1] + j, data[i + 2] + j, palette);
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
      }
    }
  }

  if (original) {
    // Post-process: white in the binary result → original color; black → darkest palette ink.
    for (let i = 0; i < data.length; i += 4) {
      if (skipAlpha && original[i + 3] === 0) continue;
      if (data[i] > 127) {
        data[i] = original[i];
        data[i + 1] = original[i + 1];
        data[i + 2] = original[i + 2];
      } else {
        data[i] = darkest[0];
        data[i + 1] = darkest[1];
        data[i + 2] = darkest[2];
      }
    }
  }

  // Strength: blend the dithered result back over the pre-dither (post-blur)
  // source. At 100% the result is unchanged; at 0% no dither is visible.
  if (preStrength) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = preStrength[i] + (data[i] - preStrength[i]) * blendMix;
      data[i + 1] = preStrength[i + 1] + (data[i + 1] - preStrength[i + 1]) * blendMix;
      data[i + 2] = preStrength[i + 2] + (data[i + 2] - preStrength[i + 2]) * blendMix;
    }
  }

  // Restore original RGB for fully-transparent pixels so the output is
  // byte-identical to the input there (no ink baked under alpha=0).
  if (origRGBA) {
    for (let i = 0; i < data.length; i += 4) {
      if (origRGBA[i + 3] === 0) {
        data[i] = origRGBA[i];
        data[i + 1] = origRGBA[i + 1];
        data[i + 2] = origRGBA[i + 2];
      }
    }
  }
  return img;
}

// ---------- INVERT ----------
function applyInvert(img: ImageData): ImageData {
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  return img;
}

// ---------- NOISE ----------
function applyNoise(img: ImageData, p: NoiseParams): ImageData {
  const data = img.data;
  const a = p.amount;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * a * 2;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  return img;
}

// ---------- DISPLACE ----------
// Builds a band-limited noise field, then for each output pixel samples
// the source at (x + nx*amount, y + ny*amount) with bilinear filtering.
// Two independent noise fields (one per axis) give the warp directional
// freedom. Multiple octaves overlay the field at halving scales for a
// richer "natural" texture rather than a single smooth wobble.
function buildNoiseField(
  w: number,
  h: number,
  scale: number,
  octaves: number,
  seed: number,
  channel: number,
): Float32Array {
  const out = new Float32Array(w * h);
  const oct = Math.max(1, Math.min(4, Math.floor(octaves)));
  let amp = 1;
  let totalAmp = 0;
  for (let o = 0; o < oct; o++) {
    const cellSize = Math.max(1, scale / (1 << o));
    const gridW = Math.max(2, Math.ceil(w / cellSize) + 2);
    const gridH = Math.max(2, Math.ceil(h / cellSize) + 2);
    // Value noise: random per grid cell, bilinearly interpolated.
    const grid = new Float32Array(gridW * gridH);
    for (let i = 0; i < grid.length; i++) {
      const h32 =
        ((seed + channel * 7919 + o * 104729) * 374761393 ^ (i * 668265263)) >>>
        0;
      const n = (Math.imul(h32 ^ (h32 >>> 13), 1274126177) ^
        (Math.imul(h32, 1) >>> 16)) >>>
        0;
      grid[i] = (n / 0xffffffff) * 2 - 1;
    }
    for (let y = 0; y < h; y++) {
      const gy = y / cellSize;
      const gyi = Math.floor(gy);
      const fy = gy - gyi;
      for (let x = 0; x < w; x++) {
        const gx = x / cellSize;
        const gxi = Math.floor(gx);
        const fx = gx - gxi;
        const i00 = gyi * gridW + gxi;
        const i10 = i00 + 1;
        const i01 = i00 + gridW;
        const i11 = i01 + 1;
        const v0 = grid[i00] * (1 - fx) + grid[i10] * fx;
        const v1 = grid[i01] * (1 - fx) + grid[i11] * fx;
        out[y * w + x] += (v0 * (1 - fy) + v1 * fy) * amp;
      }
    }
    totalAmp += amp;
    amp *= 0.5;
  }
  // Normalize to roughly [-1, 1] regardless of octave count.
  if (totalAmp > 0) {
    for (let i = 0; i < out.length; i++) out[i] /= totalAmp;
  }
  return out;
}

function applyDisplace(img: ImageData, p: DisplaceParams): ImageData {
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
      // Bilinear sample of src at (sx, sy) — clamp to image edges.
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
}

// ---------- CHROMATIC SHIFT ----------
// Print-style misregistration: R and B channels offset in opposite
// directions; G stays put. Linear mode = constant offset across the
// image; radial mode scales the offset with distance from center (the
// way a real lens defocuses RGB at the edges).
function applyChromatic(img: ImageData, p: ChromaticParams): ImageData {
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
        // Offset grows with distance; direction is radial outward.
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
}

// ---------- EDGE BLEED ----------
// Morphological dilation (or erosion) of the dark areas, with per-pixel
// noise jittering the *coverage* of the spread so the bleed feels uneven
// and organic rather than a clean halo. Separable min/max passes keep it
// O(N·R) instead of O(N·R²).
function minFilterSeparable(buf: Uint8ClampedArray, w: number, h: number, r: number, channels: 3 | 4 = 3) {
  if (r < 1) return;
  const tmp = new Uint8ClampedArray(buf.length);
  // Horizontal pass into tmp
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < channels; c++) {
      for (let x = 0; x < w; x++) {
        let m = 255;
        const lo = Math.max(0, x - r);
        const hi = Math.min(w - 1, x + r);
        for (let xi = lo; xi <= hi; xi++) {
          const v = buf[(y * w + xi) * 4 + c];
          if (v < m) m = v;
        }
        tmp[(y * w + x) * 4 + c] = m;
      }
    }
  }
  // Vertical pass back into buf
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < channels; c++) {
      for (let y = 0; y < h; y++) {
        let m = 255;
        const lo = Math.max(0, y - r);
        const hi = Math.min(h - 1, y + r);
        for (let yi = lo; yi <= hi; yi++) {
          const v = tmp[(yi * w + x) * 4 + c];
          if (v < m) m = v;
        }
        buf[(y * w + x) * 4 + c] = m;
      }
    }
  }
}

function maxFilterSeparable(buf: Uint8ClampedArray, w: number, h: number, r: number, channels: 3 | 4 = 3) {
  if (r < 1) return;
  const tmp = new Uint8ClampedArray(buf.length);
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < channels; c++) {
      for (let x = 0; x < w; x++) {
        let m = 0;
        const lo = Math.max(0, x - r);
        const hi = Math.min(w - 1, x + r);
        for (let xi = lo; xi <= hi; xi++) {
          const v = buf[(y * w + xi) * 4 + c];
          if (v > m) m = v;
        }
        tmp[(y * w + x) * 4 + c] = m;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < channels; c++) {
      for (let y = 0; y < h; y++) {
        let m = 0;
        const lo = Math.max(0, y - r);
        const hi = Math.min(h - 1, y + r);
        for (let yi = lo; yi <= hi; yi++) {
          const v = tmp[(yi * w + x) * 4 + c];
          if (v > m) m = v;
        }
        buf[(y * w + x) * 4 + c] = m;
      }
    }
  }
}

function applyEdgeBleed(img: ImageData, p: EdgeBleedParams): ImageData {
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
  // Feather: soften the hard halo by blurring the spread buffer. Blur of
  // the uniform interior is a no-op; blur of the boundary fades the edge
  // gradient — exactly the "ink soaking into paper edge" look.
  const fr = Math.round(p.feather);
  if (fr > 0) boxBlur(spread, w, h, fr);
  // Coverage map: 1 = full spread everywhere; jitter reduces coverage in
  // some regions so the bleed is uneven instead of a clean halo. Single
  // octave is plenty — we want low-frequency mottled coverage, not a
  // shimmering pattern.
  const noise = p.jitter > 0 ? buildNoiseField(w, h, p.scale, 1, p.seed, 0) : null;
  const mix = p.strength / 100;
  const dst = img.data;
  for (let i = 0; i < dst.length; i += 4) {
    let coverage = 1;
    if (noise) {
      // noise is roughly [-1, 1]; remap to [0, 1] and weight by jitter%.
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
}

export function applyLayer(img: ImageData, layer: Layer): ImageData {
  switch (layer.kind) {
    case "blur":
      return applyBlur(img, layer.params);
    case "progressiveBlur":
      return applyProgressiveBlur(img, layer.params);
    case "color":
      return applyColor(img, layer.params);
    case "curves":
      return applyCurves(img, layer.params);
    case "halftone":
      return applyHalftone(img, layer.params);
    case "dither":
      return applyDither(img, layer.params);
    case "invert":
      return applyInvert(img);
    case "noise":
      return applyNoise(img, layer.params);
    case "grain":
      return applyGrain(img, layer.params);
    case "displace":
      return applyDisplace(img, layer.params);
    case "chromatic":
      return applyChromatic(img, layer.params);
    case "edgeBleed":
      return applyEdgeBleed(img, layer.params);
    case "duotone":
      return applyDuotoneShader(img, layer.params);
  }
}

// ---------- GPU dispatch ----------
// Effects with a GPU implementation. Adjacent GPU layers are batched into a
// single ping-pong run so the source is uploaded once and read back once.
// CPU layers (dither error-diffusion, halftone, etc.) interleave naturally —
// the batch is flushed whenever a CPU layer is encountered.
const GPU_EFFECTS: { [K in EffectKind]?: GpuEffect<ParamsByKind[K]> } = {
  color: colorGpu,
  curves: curvesGpu,
};

export function runStack(img: ImageData, layers: readonly Layer[]): ImageData {
  const gpuOk = isGpuAvailable();
  let current = img;
  let batch: GpuChainItem[] = [];
  const flush = () => {
    if (batch.length === 0) return;
    current = runGpuChain(current, batch);
    batch = [];
  };
  for (const layer of layers) {
    if (!layer.enabled) continue;
    const gpu = gpuOk
      ? (GPU_EFFECTS[layer.kind] as GpuEffect<unknown> | undefined)
      : undefined;
    if (gpu) {
      batch.push({ effect: gpu, params: layer.params });
    } else {
      flush();
      current = applyLayer(current, layer);
    }
  }
  flush();
  return current;
}

export function summarizeLayer(layer: Layer): string {
  switch (layer.kind) {
    case "blur":
      return `radius ${layer.params.radius}`;
    case "progressiveBlur": {
      const p = layer.params;
      const dir = p.direction === "radial" ? "radial" : `${p.angle}°`;
      return `${dir} · max ${p.maxRadius}px${p.invert ? " · inv" : ""}`;
    }
    case "color": {
      const p = layer.params;
      return `c${p.contrast} · b${p.brightness} · γ${p.gamma.toFixed(2)}`;
    }
    case "curves": {
      const channels: { id: CurveChannel; tag: string }[] = [
        { id: "rgb", tag: "rgb" },
        { id: "r", tag: "r" },
        { id: "g", tag: "g" },
        { id: "b", tag: "b" },
      ];
      const active = channels
        .filter((c) => !isIdentityCurve(layer.params[c.id]))
        .map((c) => c.tag);
      return active.length === 0 ? "identity" : active.join(" · ");
    }
    case "halftone": {
      const p = layer.params;
      return `${p.shape} · ${p.size}px · ${p.angle}°${p.goo > 0 ? ` · goo ${p.goo}` : ""}`;
    }
    case "dither":
      return `${layer.params.algo} · ${layer.params.palette}`;
    case "invert":
      return "flip values";
    case "noise":
      return `amount ${layer.params.amount}`;
    case "grain": {
      const p = layer.params;
      const colorTag =
        p.colorAmount > 0 ? ` · ${p.colorAmount === 100 ? "color" : `c${p.colorAmount}`}` : "";
      return `${p.amount} · ${p.size.toFixed(1)}px${colorTag}`;
    }
    case "displace": {
      const p = layer.params;
      return `${p.amount}px · scale ${p.scale} · oct ${p.octaves}`;
    }
    case "chromatic": {
      const p = layer.params;
      return `${p.amount}px · ${p.mode === "radial" ? "radial" : `${p.angle}°`}`;
    }
    case "edgeBleed": {
      const p = layer.params;
      return `${p.amount}px · ${p.polarity === "spread-dark" ? "dark→" : "light→"} · j${p.jitter}`;
    }
    case "duotone": {
      const p = layer.params;
      return `${p.tile}px · t${p.thickness.toFixed(2)} · ×${p.lengthScale.toFixed(2)}`;
    }
  }
}
