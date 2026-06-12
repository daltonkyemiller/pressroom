import type { EffectModule } from "../types";
import { boxBlur } from "../utils";

export type BlurParams = { radius: number };

export const blur: EffectModule<"blur", BlurParams> = {
  kind: "blur",
  label: "Blur",
  description: "soften input",
  defaults: { radius: 2 },
  apply(img, p) {
    boxBlur(img.data, img.width, img.height, p.radius);
    return img;
  },
  summarize: (p) => `radius ${p.radius}`,
  scaleParams: (p, s) => ({ radius: p.radius * s }),
};
