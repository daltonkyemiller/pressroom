// Dirt effect — adds film dust, scratches, and hairs over the source.
//
// The look is reference-print-era film dirt: white-and-dark specks where
// dust settled on the negative; long thin scratches from projector wear
// (mostly light, because a scratch reveals the unexposed back); curved
// hairs from emulsion fibers. Each particle class has its own slider so
// you can dial just-dust, just-scratches, or any combination.
//
// Particles are generated deterministically from a seed + index hash, so
// changing the seed reshuffles everything but the same seed always
// reproduces the same dirt — important for re-render consistency.

import type { EffectModule } from "../types";
import { hash, hashSigned, hexToRgb255 } from "../utils";

export type DirtParams = {
  /** 0..100. Overall density multiplier; scales every particle count. */
  amount: number;
  /** 0..100. Density of small specks (most common film dirt). */
  dust: number;
  /** 0..100. Density of thin, mostly-straight scratches. */
  scratches: number;
  /** 0..100. Density of curved hair / fiber marks. */
  hairs: number;
  /** 0.5..3. Multiplier on every particle's size (radius, length, thickness). */
  size: number;
  /** 0..100. How opaque each particle is. */
  intensity: number;
  /** 0..100. Share of particles drawn DARK vs LIGHT. 70 → mostly dark
   *  specks, sparse light scratches — the typical "dust on emulsion +
   *  scratches reveal backing" film print look. */
  darkness: number;
  /** Hex color used for dark particles. Light particles always use white. */
  color: string;
  seed: number;
};

export const dirt: EffectModule<"dirt", DirtParams> = {
  kind: "dirt",
  label: "Dirt",
  description: "film dust · scratches · hairs",
  defaults: {
    amount: 30,
    dust: 60,
    scratches: 30,
    hairs: 20,
    size: 1,
    intensity: 70,
    darkness: 70,
    color: "#0a0a0a",
    seed: 1,
  },
  apply(img, p) {
    if (p.amount <= 0 || p.intensity <= 0) return img;
    const w = img.width;
    const h = img.height;
    const data = img.data;

    // Particle counts scale with canvas area so visual density stays
    // constant across preview / export resolutions without the user
    // having to re-tune.
    const areaUnits = (w * h) / 10000; // count of 100×100 blocks
    const baseCount = Math.max(0, (p.amount / 100) * areaUnits);
    const dustCount = Math.round(baseCount * (p.dust / 100) * 8);
    const scratchCount = Math.round(baseCount * (p.scratches / 100));
    const hairCount = Math.round(baseCount * (p.hairs / 100) * 2);
    if (dustCount + scratchCount + hairCount === 0) return img;

    const size = Math.max(0.1, p.size);
    const intensity = p.intensity / 100;
    const darknessP = p.darkness / 100;
    const [tr, tg, tb] = hexToRgb255(p.color);

    // Draw all particles onto an offscreen canvas in one go, then
    // composite the alpha layer onto the source. Drawing to canvas
    // gives us anti-aliased strokes (round line caps, quadratic
    // curves) effectively for free.
    const dirtCanvas = new OffscreenCanvas(w, h);
    const ctx = dirtCanvas.getContext("2d");
    if (!ctx) return img;
    ctx.clearRect(0, 0, w, h);

    const seed = p.seed;
    const SEED_DUST = seed + 1000;
    const SEED_SCRATCH = seed + 2000;
    const SEED_HAIR = seed + 3000;

    // ---- dust: small specks of varied size + opacity ----
    for (let i = 0; i < dustCount; i++) {
      const x = hash(SEED_DUST, i * 7 + 1) * w;
      const y = hash(SEED_DUST, i * 7 + 2) * h;
      // Heavily skewed toward small specks — cube the random so 80%+
      // of dust is sub-1.5px even at size=1.
      const sizeR = hash(SEED_DUST, i * 7 + 3);
      const radius = (0.4 + sizeR * sizeR * sizeR * 2.6) * size;
      const isDark = hash(SEED_DUST, i * 7 + 4) < darknessP;
      const alpha = intensity * (0.35 + hash(SEED_DUST, i * 7 + 5) * 0.65);
      ctx.fillStyle = isDark
        ? `rgba(${tr},${tg},${tb},${alpha})`
        : `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- scratches: thin straight-ish lines (a touch of curve) ----
    for (let i = 0; i < scratchCount; i++) {
      const x1 = hash(SEED_SCRATCH, i * 9 + 1) * w;
      const y1 = hash(SEED_SCRATCH, i * 9 + 2) * h;
      // Scratches biased toward near-vertical (projector path) — clamp
      // angle to ±30° from vertical for ~70% of them.
      const angleNudge = hash(SEED_SCRATCH, i * 9 + 3);
      const angle =
        angleNudge < 0.7
          ? -Math.PI / 2 + hashSigned(SEED_SCRATCH, i * 9 + 4) * (Math.PI / 6)
          : hash(SEED_SCRATCH, i * 9 + 4) * Math.PI * 2;
      const length = (15 + hash(SEED_SCRATCH, i * 9 + 5) * 80) * size;
      const x2 = x1 + Math.cos(angle) * length;
      const y2 = y1 + Math.sin(angle) * length;
      const thickness = (0.4 + hash(SEED_SCRATCH, i * 9 + 6) * 0.6) * size;
      // Scratches are MOSTLY light (they reveal the unexposed back of
      // the negative); flip the darkness coin toward light here.
      const isDark = hash(SEED_SCRATCH, i * 9 + 7) < darknessP * 0.4;
      const alpha = intensity * (0.3 + hash(SEED_SCRATCH, i * 9 + 8) * 0.5);
      ctx.strokeStyle = isDark
        ? `rgba(${tr},${tg},${tb},${alpha})`
        : `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = thickness;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // ---- hairs: longer curved fibers ----
    for (let i = 0; i < hairCount; i++) {
      const x1 = hash(SEED_HAIR, i * 11 + 1) * w;
      const y1 = hash(SEED_HAIR, i * 11 + 2) * h;
      const angle = hash(SEED_HAIR, i * 11 + 3) * Math.PI * 2;
      const length = (25 + hash(SEED_HAIR, i * 11 + 4) * 90) * size;
      // Quadratic bezier with one control point pulled sideways by a
      // fraction of the length — gives a natural curve.
      const curve = hashSigned(SEED_HAIR, i * 11 + 5) * length * 0.35;
      const perpAngle = angle + Math.PI / 2;
      const xMid = x1 + Math.cos(angle) * length * 0.5 + Math.cos(perpAngle) * curve;
      const yMid = y1 + Math.sin(angle) * length * 0.5 + Math.sin(perpAngle) * curve;
      const x2 = x1 + Math.cos(angle) * length;
      const y2 = y1 + Math.sin(angle) * length;
      const thickness = (0.3 + hash(SEED_HAIR, i * 11 + 6) * 0.5) * size;
      // Hairs are typically darker — fibers cast on light areas.
      const isDark = hash(SEED_HAIR, i * 11 + 7) < darknessP * 1.2;
      const alpha = intensity * (0.4 + hash(SEED_HAIR, i * 11 + 8) * 0.4);
      ctx.strokeStyle = isDark
        ? `rgba(${tr},${tg},${tb},${alpha})`
        : `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = thickness;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(xMid, yMid, x2, y2);
      ctx.stroke();
    }

    // Composite the alpha-channel dirt layer onto the source. Simple
    // "source over": each pixel mixes toward the dirt color by its
    // alpha. The source's own alpha is preserved.
    const dirtImg = ctx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      const dirtA = dirtImg[i + 3];
      if (dirtA === 0) continue;
      const a = dirtA / 255;
      const inv = 1 - a;
      data[i] = data[i] * inv + dirtImg[i] * a;
      data[i + 1] = data[i + 1] * inv + dirtImg[i + 1] * a;
      data[i + 2] = data[i + 2] * inv + dirtImg[i + 2] * a;
    }
    return img;
  },
  summarize: (p) => {
    const parts: string[] = [];
    if (p.dust > 0) parts.push(`dust ${p.dust}`);
    if (p.scratches > 0) parts.push(`scr ${p.scratches}`);
    if (p.hairs > 0) parts.push(`hair ${p.hairs}`);
    return parts.length > 0 ? parts.join(" · ") : "no particles";
  },
  // Size is the only px-dimensioned param; particle counts already scale
  // with canvas area (via `areaUnits` in apply), so density stays constant
  // across preview / export resolutions.
  scaleParams: (p, s) => ({ ...p, size: p.size * s }),
};
