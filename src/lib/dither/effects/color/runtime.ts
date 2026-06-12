import type { EffectModule } from "../types";
import { colorGpu } from "../../gpu/effects/color";

export type ColorParams = {
  contrast: number;
  brightness: number;
  gamma: number;
  saturation: number;
  // Warm/cool axis (-100..+100). Positive = warm (boost R, drop B);
  // negative = cool (drop R, boost B). At ±100 each channel shifts by ±50.
  temperature: number;
  // Magenta/green axis (-100..+100). Positive = magenta (boost R+B, drop G);
  // negative = green (drop R+B, boost G).
  tint: number;
};

export const color: EffectModule<"color", ColorParams> = {
  kind: "color",
  label: "Color adjust",
  description: "contrast · gamma",
  defaults: {
    contrast: 0,
    brightness: 0,
    gamma: 1,
    saturation: 100,
    temperature: 0,
    tint: 0,
  },
  apply(img, p) {
    const data = img.data;
    const c = p.contrast / 100;
    const cFactor = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));
    const b = p.brightness;
    const g = p.gamma;
    const s = p.saturation / 100;
    // Each color-balance axis maxes at ±50 channel units at ±100 on the
    // slider. Both balance shifts run BEFORE saturation so the saturation
    // knob pulls toward grey of the warmed/tinted balance.
    const tempShift = (p.temperature / 100) * 50;
    const tintShift = (p.tint / 100) * 50;
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
      r += tempShift;
      bl -= tempShift;
      r += tintShift * 0.5;
      bl += tintShift * 0.5;
      gr -= tintShift;
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
  },
  summarize: (p) => `c${p.contrast} · b${p.brightness} · γ${p.gamma.toFixed(2)}`,
  gpu: colorGpu,
};
