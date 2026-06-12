import type { EffectModule } from "../types";
import { applyGrain, GRAIN_DEFAULTS, type GrainParams } from "../../grain";

export type { GrainParams } from "../../grain";

export const grain: EffectModule<"grain", GrainParams> = {
  kind: "grain",
  label: "Grain",
  description: "film · tonal response",
  defaults: GRAIN_DEFAULTS,
  apply: applyGrain,
  summarize: (p) => {
    const colorTag =
      p.colorAmount > 0 ? ` · ${p.colorAmount === 100 ? "color" : `c${p.colorAmount}`}` : "";
    return `${p.amount} · ${p.size.toFixed(1)}px${colorTag}`;
  },
};
