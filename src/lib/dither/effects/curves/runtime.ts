import type { EffectModule } from "../types";
import {
  applyCurves,
  CURVES_DEFAULTS,
  isIdentityCurve,
  type CurveChannel,
  type CurvesParams,
} from "../../curves";
import { curvesGpu } from "../../gpu/effects/curves";

export type { CurvesParams } from "../../curves";

export const curves: EffectModule<"curves", CurvesParams> = {
  kind: "curves",
  label: "Curves",
  description: "tonal map · per channel",
  defaults: CURVES_DEFAULTS,
  apply: applyCurves,
  summarize: (p) => {
    const channels: { id: CurveChannel; tag: string }[] = [
      { id: "rgb", tag: "rgb" },
      { id: "r", tag: "r" },
      { id: "g", tag: "g" },
      { id: "b", tag: "b" },
    ];
    const active = channels.filter((c) => !isIdentityCurve(p[c.id])).map((c) => c.tag);
    return active.length === 0 ? "identity" : active.join(" · ");
  },
  gpu: curvesGpu,
};
