import type { EffectModule } from "../types";
import { BAYER4, BAYER8, KERNELS } from "../../kernels";
import { PALETTES, nearestColor, type PaletteId } from "../../palettes";
import { boxBlur, getFlatKernel, hexToRgb255 } from "../utils";

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
  // Pixel size of each dithered cell. 1 = native (one decision per
  // pixel). Higher = chunkier "retro" look (image is downsampled by
  // this factor before dithering, then nearest-neighbor upsampled back).
  // Scales with render resolution so size=2 at the 900px reference
  // looks the same at any preview / export dim.
  cellSize: number;
};

export const dither: EffectModule<"dither", DitherParams> = {
  kind: "dither",
  label: "Dither",
  description: "8 algorithms",
  defaults: {
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
    cellSize: 1,
  },
  apply(img, p) {
    // Chunky-pixel path. The dither logic itself is unchanged; we just
    // downsample the input by cellSize, dither at small res, then
    // nearest-neighbor upsample. Each dither decision now drives a
    // cellSize × cellSize block of output pixels — the "retro" look.
    // Round here so old payloads with no `cellSize` field default to 1.
    const cellSize = Math.max(1, Math.round(p.cellSize ?? 1));
    if (cellSize > 1) {
      return ditherAtCellSize(img, p, cellSize);
    }
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

    if (p.preBlur > 0) boxBlur(data, w, h, Math.round(p.preBlur));

    // In preserveColors mode we dither against pure b&w to get a clean
    // binary mask, then swap the "white" pixels back to the original RGB.
    const bwPalette = PALETTES.bw;
    const palette = p.preserveColors ? bwPalette : userPalette;
    let darkest: readonly [number, number, number] = userPalette[0];
    let original: Uint8ClampedArray | null = null;
    if (p.preserveColors) {
      original = new Uint8ClampedArray(data);
      darkest = hexToRgb255(p.inkColor ?? "#000000");
    }

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
          const [nr, ng, nb] = nearestColor(
            data[i] + j,
            data[i + 1] + j,
            data[i + 2] + j,
            palette,
          );
          data[i] = nr;
          data[i + 1] = ng;
          data[i + 2] = nb;
        }
      }
    }

    if (original) {
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

    if (preStrength) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = preStrength[i] + (data[i] - preStrength[i]) * blendMix;
        data[i + 1] = preStrength[i + 1] + (data[i + 1] - preStrength[i + 1]) * blendMix;
        data[i + 2] = preStrength[i + 2] + (data[i + 2] - preStrength[i + 2]) * blendMix;
      }
    }

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
  },
  summarize: (p) => {
    const cs = Math.round(p.cellSize ?? 1);
    return `${p.algo} · ${p.palette}${cs > 1 ? ` · ${cs}px` : ""}`;
  },
  // preBlur is px-dimensioned. matrixScale is a luminance amplitude
  // (16..128 on the Bayer matrix), not a px size — leave untouched.
  // jitter, strength, diffusion are all percentages.
  // cellSize scales so the chunky pattern keeps the same visual size
  // across preview / export render resolutions.
  scaleParams: (p, s) => ({
    ...p,
    preBlur: p.preBlur * s,
    cellSize: Math.max(1, (p.cellSize ?? 1) * s),
  }),
};

// Wraps the main dither path with a downsample → dither → nearest-
// neighbor upsample sandwich so each dither decision drives a
// cellSize × cellSize block instead of a single pixel.
function ditherAtCellSize(
  img: ImageData,
  p: DitherParams,
  cellSize: number,
): ImageData {
  const w = img.width;
  const h = img.height;
  const smallW = Math.max(1, Math.floor(w / cellSize));
  const smallH = Math.max(1, Math.floor(h / cellSize));

  // Downsample with smoothing so each small-cell pixel is the average
  // of the cellSize × cellSize source neighborhood — cleaner than
  // sampling one source pixel per block.
  const srcCanvas = new OffscreenCanvas(w, h);
  srcCanvas.getContext("2d")!.putImageData(img, 0, 0);
  const smallCanvas = new OffscreenCanvas(smallW, smallH);
  const sctx = smallCanvas.getContext("2d", { willReadFrequently: true })!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(srcCanvas, 0, 0, smallW, smallH);
  const smallImg = sctx.getImageData(0, 0, smallW, smallH);

  // Run the regular dither path on the small image. We re-enter `apply`
  // with cellSize=1 so the inner loops execute (the cellSize>1 branch
  // would recurse forever otherwise).
  dither.apply(smallImg, { ...p, cellSize: 1 });

  // Upsample back into img with nearest-neighbor so each small pixel
  // becomes a clean cellSize × cellSize block (no bilinear blur on the
  // block edges — that would defeat the whole effect).
  smallCanvas.getContext("2d")!.putImageData(smallImg, 0, 0);
  const dstCanvas = new OffscreenCanvas(w, h);
  const dctx = dstCanvas.getContext("2d")!;
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(smallCanvas, 0, 0, w, h);
  const result = dctx.getImageData(0, 0, w, h);
  img.data.set(result.data);
  return img;
}
