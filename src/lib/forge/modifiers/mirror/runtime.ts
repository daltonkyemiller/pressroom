import type { ModifierModule } from "../types";
import type { Instance } from "../../engine";

export type MirrorParams = {
  axis: "x" | "y";
  center: number;
};

export const mirror: ModifierModule<"mirror", MirrorParams> = {
  kind: "mirror",
  label: "Mirror",
  defaults: (c) => ({ axis: "y", center: c.x }),
  apply(instances, params, ctx) {
    const out: Instance[] = [];
    const { axis, center } = params;
    const reflect =
      axis === "x"
        ? `translate(0 ${2 * center}) scale(1 -1)`
        : `translate(${2 * center} 0) scale(-1 1)`;
    for (const inst of instances) {
      out.push(inst);
      out.push({ ...inst, transform: ctx.composeTransform(inst.transform, reflect) });
    }
    return out;
  },
};
