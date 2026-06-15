// Film-grain effect — deterministic noise field bilinearly sampled at
// arbitrary cell size, with separate shadow / highlight intensity response,
// tonal falloff curve, anisotropic aspect, color/mono blend, tint bias,
// and choice of blend mode.

export type GrainBlend = "add" | "multiply" | "screen";

export type GrainParams = {
  amount: number; // 0..100 — overall intensity
  size: number; // 0.5..6 — grain particle size in pixels
  roughness: number; // 0..100 — softens the noise field
  shadows: number; // 0..200 — % grain intensity in dark areas
  highlights: number; // 0..200 — % grain intensity in bright areas
  falloff: number; // 0.3..3 — gamma curve on the shadow→highlight blend
  aspect: number; // -100..100 — anisotropy; +stretches horizontal, -stretches vertical
  colorAmount: number; // 0..100 — 0 = mono, 100 = full independent per-channel noise
  tintColor: string; // hex — bias hue for the noise
  tintStrength: number; // 0..100 — how much the tint biases per-channel intensity
  blend: GrainBlend; // how grain is combined with the source
  seed: number; // 0..9999 — pattern seed; change to re-roll
};

export const GRAIN_DEFAULTS: GrainParams = {
  amount: 35,
  size: 1.4,
  roughness: 20,
  shadows: 140,
  highlights: 60,
  falloff: 1,
  aspect: 0,
  colorAmount: 0,
  tintColor: "#ffffff",
  tintStrength: 0,
  blend: "add",
  seed: 42,
};

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number) {
  return (rng() + rng() + rng()) / 3 - 0.5;
}

function boxBlurField(field: Float32Array, w: number, h: number, channels: number, r: number) {
  if (r < 1) return;
  const tmp = new Float32Array(field.length);
  const div = r * 2 + 1;
  for (let c = 0; c < channels; c++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const xi = Math.max(0, Math.min(w - 1, i));
        sum += field[(y * w + xi) * channels + c];
      }
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * channels + c] = sum / div;
        const x1 = Math.max(0, x - r);
        const x2 = Math.min(w - 1, x + r + 1);
        sum += field[(y * w + x2) * channels + c] - field[(y * w + x1) * channels + c];
      }
    }
  }
  for (let c = 0; c < channels; c++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const yi = Math.max(0, Math.min(h - 1, i));
        sum += tmp[(yi * w + x) * channels + c];
      }
      for (let y = 0; y < h; y++) {
        field[(y * w + x) * channels + c] = sum / div;
        const y1 = Math.max(0, y - r);
        const y2 = Math.min(h - 1, y + r + 1);
        sum += tmp[(y2 * w + x) * channels + c] - tmp[(y1 * w + x) * channels + c];
      }
    }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean;
  const n = Number.parseInt(full, 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

export function applyGrain(img: ImageData, p: GrainParams): ImageData {
  const w = img.width;
  const h = img.height;
  const data = img.data;

  // Anisotropic stretch: positive aspect → horizontal grain; negative → vertical.
  const ratio = p.aspect / 100;
  const stretchX = Math.pow(2, ratio);
  const stretchY = Math.pow(2, -ratio);
  const baseSize = Math.max(0.1, p.size);
  // Cap the noise grid at the output resolution. Below this cap, baseSize
  // < 1 would generate a *denser* noise field than the source — but
  // bilinear sampling between denser noise values just averages them,
  // smoothing the result instead of producing finer grain. Worse, at very
  // small baseSize the array allocation alone would crash (size=0.1 on a
  // 1800px preview wants 243M floats ≈ 1GB). Capping at w/h means
  // "one noise value per output pixel" is the visual floor — the genuinely
  // finest grain the bilinear path can produce. The slider goes down to
  // 0.1 anyway so users can see the curve flatten there.
  const nw = Math.min(w, Math.max(1, Math.round(w / (baseSize * stretchX))));
  const nh = Math.min(h, Math.max(1, Math.round(h / (baseSize * stretchY))));

  // Always generate 3 channels — we mix between mono and color per pixel.
  const noise = new Float32Array(nw * nh * 3);
  const rng = mulberry32(p.seed * 1013904223 + 7);
  for (let i = 0; i < noise.length; i++) noise[i] = gauss(rng);

  if (p.roughness > 0) {
    const r = Math.max(1, Math.round((p.roughness / 100) * 3));
    boxBlurField(noise, nw, nh, 3, r);
  }

  // Per-channel tint multiplier. tintNorm normalises so the average channel
  // stays 1 — that way tint only redistributes, doesn't amplify the grain.
  const [tr, tg, tb] = hexToRgb(p.tintColor);
  const tintMean = Math.max(1e-4, (tr + tg + tb) / 3);
  const tintNorm: [number, number, number] = [tr / tintMean, tg / tintMean, tb / tintMean];
  const tintMix = p.tintStrength / 100;
  const tintMul: [number, number, number] = [
    1 + (tintNorm[0] - 1) * tintMix,
    1 + (tintNorm[1] - 1) * tintMix,
    1 + (tintNorm[2] - 1) * tintMix,
  ];

  const baseAmount = (p.amount / 100) * 160; // scale into 0..255 RGB space
  const shadowsM = p.shadows / 100;
  const highlightsM = p.highlights / 100;
  const falloff = Math.max(0.05, p.falloff);
  const colorMix = p.colorAmount / 100;
  const sx = nw / w;
  const sy = nh / h;
  const blend = p.blend;

  for (let y = 0; y < h; y++) {
    const ny = y * sy;
    const ny0 = Math.floor(ny);
    const ny1 = Math.min(nh - 1, ny0 + 1);
    const fy = ny - ny0;
    for (let x = 0; x < w; x++) {
      const nx = x * sx;
      const nx0 = Math.floor(nx);
      const nx1 = Math.min(nw - 1, nx0 + 1);
      const fx = nx - nx0;
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      // gamma-shaped blend: small falloff biases the curve toward shadows.
      const t = Math.pow(Math.min(1, Math.max(0, L)), 1 / falloff);
      const mul = shadowsM * (1 - t) + highlightsM * t;
      const local = baseAmount * mul;

      // Bilinear sample all 3 channels.
      let nr = 0;
      let ng = 0;
      let nb = 0;
      {
        const a00 = (ny0 * nw + nx0) * 3;
        const a01 = (ny0 * nw + nx1) * 3;
        const a10 = (ny1 * nw + nx0) * 3;
        const a11 = (ny1 * nw + nx1) * 3;
        const r0 = noise[a00] * (1 - fx) + noise[a01] * fx;
        const r1 = noise[a10] * (1 - fx) + noise[a11] * fx;
        nr = r0 * (1 - fy) + r1 * fy;
        const g0 = noise[a00 + 1] * (1 - fx) + noise[a01 + 1] * fx;
        const g1 = noise[a10 + 1] * (1 - fx) + noise[a11 + 1] * fx;
        ng = g0 * (1 - fy) + g1 * fy;
        const b0 = noise[a00 + 2] * (1 - fx) + noise[a01 + 2] * fx;
        const b1 = noise[a10 + 2] * (1 - fx) + noise[a11 + 2] * fx;
        nb = b0 * (1 - fy) + b1 * fy;
      }

      // Mono ↔ color blend: at colorMix=0 every channel uses the average;
      // at colorMix=1 each channel gets its own independent noise.
      const avg = (nr + ng + nb) / 3;
      const ncR = avg + (nr - avg) * colorMix;
      const ncG = avg + (ng - avg) * colorMix;
      const ncB = avg + (nb - avg) * colorMix;

      const dR = ncR * tintMul[0] * local;
      const dG = ncG * tintMul[1] * local;
      const dB = ncB * tintMul[2] * local;

      let outR: number;
      let outG: number;
      let outB: number;
      if (blend === "add") {
        outR = r + dR;
        outG = g + dG;
        outB = b + dB;
      } else if (blend === "multiply") {
        // multiplicative grain — centered at 1, deviates by ±(local/255)
        outR = r * (1 + (2 * dR) / 255);
        outG = g * (1 + (2 * dG) / 255);
        outB = b * (1 + (2 * dB) / 255);
      } else {
        // screen-like — brightens; noise scaled by (255 - pixel)
        outR = 255 - (255 - r) * (1 - (2 * dR) / 255);
        outG = 255 - (255 - g) * (1 - (2 * dG) / 255);
        outB = 255 - (255 - b) * (1 - (2 * dB) / 255);
      }

      data[idx] = outR < 0 ? 0 : outR > 255 ? 255 : outR;
      data[idx + 1] = outG < 0 ? 0 : outG > 255 ? 255 : outG;
      data[idx + 2] = outB < 0 ? 0 : outB > 255 ? 255 : outB;
    }
  }
  return img;
}
