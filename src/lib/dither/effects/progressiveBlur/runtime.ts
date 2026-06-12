import type { EffectModule } from "../types";
import {
  applyProgressiveBlur,
  PROGRESSIVE_BLUR_DEFAULTS,
  type ProgressiveBlurParams,
} from "../../progressive-blur";

export type { ProgressiveBlurParams } from "../../progressive-blur";

export const progressiveBlur: EffectModule<"progressiveBlur", ProgressiveBlurParams> = {
  kind: "progressiveBlur",
  label: "Progressive blur",
  description: "gradient · radial",
  defaults: PROGRESSIVE_BLUR_DEFAULTS,
  apply: applyProgressiveBlur,
  summarize: (p) => {
    const dir = p.direction === "radial" ? "radial" : `${p.angle}°`;
    return `${dir} · max ${p.maxRadius}px${p.invert ? " · inv" : ""}`;
  },
  scaleParams: (p, s) => ({ ...p, maxRadius: p.maxRadius * s }),
};
