import type { EffectModule } from "../types";
import { applyDuotoneShader, DUOTONE_DEFAULTS, type DuotoneParams } from "../../shader-duotone";

export type { DuotoneParams } from "../../shader-duotone";

export const duotone: EffectModule<"duotone", DuotoneParams> = {
  kind: "duotone",
  label: "Duotone dashes",
  description: "shader · capsule grid",
  defaults: DUOTONE_DEFAULTS,
  apply: applyDuotoneShader,
  summarize: (p) =>
    `${p.tile}px · t${p.thickness.toFixed(2)} · ×${p.lengthScale.toFixed(2)}`,
  // tile = capsule cell pitch (px), blurRadius = pre-blur (px).
  // thickness/lengthScale are ratios, contrast/brightness are intensities.
  scaleParams: (p, s) => ({ ...p, tile: p.tile * s, blurRadius: p.blurRadius * s }),
};
