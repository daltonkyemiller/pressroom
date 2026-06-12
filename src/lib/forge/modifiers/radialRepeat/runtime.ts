import type { ModifierModule } from "../types";
import type { Instance } from "../../engine";

export type RadialRepeatParams = {
  count: number;
  cx: number;
  cy: number;
  arc: number; // total degrees swept (360 = full circle)
};

export const radialRepeat: ModifierModule<"radialRepeat", RadialRepeatParams> = {
  kind: "radialRepeat",
  label: "Radial repeat",
  defaults: (c) => ({ count: 4, cx: c.x, cy: c.y, arc: 360 }),
  apply(instances, params, ctx) {
    const out: Instance[] = [];
    const n = Math.max(1, Math.floor(params.count));
    const { composeTransform } = ctx;
    for (const inst of instances) {
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * params.arc;
        const t = `rotate(${angle} ${params.cx} ${params.cy})`;
        out.push({ ...inst, transform: composeTransform(inst.transform, t) });
      }
    }
    return out;
  },
};
