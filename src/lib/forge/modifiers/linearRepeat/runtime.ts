import type { ModifierModule } from "../types";
import type { Instance } from "../../engine";

export type LinearRepeatParams = {
  count: number;
  dx: number;
  dy: number;
  dRotate: number; // degrees added per step
  dScale: number; // multiplicative scale delta per step (0 = no change)
};

export const linearRepeat: ModifierModule<"linearRepeat", LinearRepeatParams> = {
  kind: "linearRepeat",
  label: "Linear repeat",
  defaults: () => ({ count: 3, dx: 30, dy: 0, dRotate: 0, dScale: 0 }),
  apply(instances, params, ctx) {
    const out: Instance[] = [];
    const n = Math.max(1, Math.floor(params.count));
    const { pivot, composeTransform } = ctx;
    for (const inst of instances) {
      for (let i = 0; i < n; i++) {
        const angle = i * params.dRotate;
        const s = 1 + i * params.dScale * 0.01;
        const t = `translate(${i * params.dx} ${i * params.dy}) rotate(${angle} ${pivot.x} ${pivot.y}) translate(${pivot.x} ${pivot.y}) scale(${s}) translate(${-pivot.x} ${-pivot.y})`;
        out.push({ ...inst, transform: composeTransform(inst.transform, t) });
      }
    }
    return out;
  },
};
