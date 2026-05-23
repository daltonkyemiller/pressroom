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
};
export type InvertParams = Record<string, never>;
export type NoiseParams = { amount: number };

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
  },
  invert: {},
  noise: { amount: 20 },
  grain: GRAIN_DEFAULTS,
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
  duotone: "shader · capsule grid",
};

// ---------- BLUR ----------
export function boxBlur(data: Uint8ClampedArray, w: number, h: number, r: number) {
  if (r < 1) return;
  const tmp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
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

  const shapes = document.createElement("canvas");
  shapes.width = w;
  shapes.height = h;
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

  let inkLayer: HTMLCanvasElement = shapes;
  if (p.goo > 0) {
    const blurAmount = (p.goo / 30) * (size * 0.6);
    const svgBlur = document.getElementById("goo-blur");
    const svgMatrix = document.getElementById("goo-matrix");
    if (svgBlur && svgMatrix) {
      svgBlur.setAttribute("stdDeviation", String(blurAmount));
      svgMatrix.setAttribute(
        "values",
        `1 0 0 0 0
         0 1 0 0 0
         0 0 1 0 0
         0 0 0 20 -9`,
      );
    }
    const gooed = document.createElement("canvas");
    gooed.width = w;
    gooed.height = h;
    const gctx = gooed.getContext("2d")!;
    gctx.filter = "url(#goo-filter)";
    gctx.drawImage(shapes, 0, 0);
    gctx.filter = "none";
    inkLayer = gooed;
  }

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
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
  let darkest = userPalette[0];
  let original: Uint8ClampedArray | null = null;
  if (p.preserveColors) {
    original = new Uint8ClampedArray(data);
    let dL = 256;
    for (const c of userPalette) {
      const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      if (L < dL) {
        dL = L;
        darkest = c;
      }
    }
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
    const kernel = KERNELS[algo];
    const serp = p.serpentine;
    const diffMul = p.diffusion / 100;
    for (let y = 0; y < h; y++) {
      const reverse = serp && y % 2 === 1;
      const xStart = reverse ? w - 1 : 0;
      const xEnd = reverse ? -1 : w;
      const xStep = reverse ? -1 : 1;
      for (let x = xStart; x !== xEnd; x += xStep) {
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
        for (const [dx, dy, wgt] of kernel.weights) {
          const ax = reverse ? x - dx : x + dx;
          const ay = y + dy;
          if (ax < 0 || ax >= w || ay >= h) continue;
          const aidx = (ay * w + ax) * 3;
          const f = wgt / kernel.denom;
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
    case "duotone":
      return applyDuotoneShader(img, layer.params);
  }
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
    case "duotone": {
      const p = layer.params;
      return `${p.tile}px · t${p.thickness.toFixed(2)} · ×${p.lengthScale.toFixed(2)}`;
    }
  }
}
