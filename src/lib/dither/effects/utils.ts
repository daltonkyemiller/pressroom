// Helpers shared across multiple Effect modules. Lives at the registry
// level so individual effect modules can stay focused on their own kind.
// No React imports — must remain worker-safe.

import { KERNELS } from "../kernels";

// ---------- BOX BLUR ----------
// Separable running-sum box blur on RGB(A) Uint8ClampedArray. Used by
// blur, halftone goo, dither pre-blur, edge bleed feather, progressive
// blur, and the text effect's mask softening.

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

// ---------- HASH / NOISE ----------

/** Deterministic 32-bit hash → [0, 1). Stable across reloads for a given seed. */
export function hash(seed: number, i: number): number {
  let n = ((seed * 374761393) ^ (i * 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 0xffffffff;
}

/** Same as hash() but mapped to [-1, 1). */
export function hashSigned(seed: number, i: number): number {
  return hash(seed, i) * 2 - 1;
}

/**
 * Band-limited value-noise field used by displacement-style effects.
 * Octaves overlay halving-scale fields for natural texture rather than
 * a single smooth wobble. Returns a w*h Float32Array normalized roughly
 * to [-1, 1].
 */
export function buildNoiseField(
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
  if (totalAmp > 0) {
    for (let i = 0; i < out.length; i++) out[i] /= totalAmp;
  }
  return out;
}

// ---------- COLOR PARSING ----------

/** Parse a hex string ("#abc" or "#aabbcc") into a [r, g, b] tuple in 0..255. */
export function hexToRgb255(hex: string): [number, number, number] {
  const clean = (hex || "").replace("#", "");
  const full = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean;
  const n = Number.parseInt(full || "0", 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

// ---------- MORPHOLOGY (separable min/max filters) ----------

/** Single-channel-or-multi-channel separable min filter. O(N·R). */
export function minFilterSeparable(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
  channels: 3 | 4 = 3,
) {
  if (r < 1) return;
  const tmp = new Uint8ClampedArray(buf.length);
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

/** Separable max filter (dilation), mirror of minFilterSeparable. */
export function maxFilterSeparable(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
  channels: 3 | 4 = 3,
) {
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

// ---------- DITHER KERNEL CACHE ----------

type FlatKernel = { dx: Int8Array; dy: Int8Array; factor: Float32Array };
const FLAT_KERNEL_CACHE = new Map<string, FlatKernel>();

/** Look up a flattened error-diffusion kernel, caching by algo name. */
export function getFlatKernel(name: string): FlatKernel {
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
