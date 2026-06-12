import type { EffectModule } from "../types";

export type InvertParams = Record<string, never>;

export const invert: EffectModule<"invert", InvertParams> = {
  kind: "invert",
  label: "Invert",
  description: "flip values",
  defaults: {},
  apply(img) {
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    return img;
  },
  summarize: () => "flip values",
};
