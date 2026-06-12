import type { EffectModule } from "../types";

export type NoiseParams = { amount: number };

export const noise: EffectModule<"noise", NoiseParams> = {
  kind: "noise",
  label: "Noise",
  description: "uniform grain",
  defaults: { amount: 20 },
  apply(img, p) {
    const data = img.data;
    const a = p.amount;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * a * 2;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    return img;
  },
  summarize: (p) => `amount ${p.amount}`,
};
