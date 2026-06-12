import type { ModifierModule } from "../types";
import type { Instance } from "../../engine";

export type ColorCycleParams = {
  colors: string[]; // explicit color list; bypass when empty (no override)
  mode: "cycle" | "random"; // cycle = i mod n, random = seeded random pick
  seed: number;
  affect: "fill" | "stroke" | "both";
};

const DEFAULT_PALETTE = ["#d96b29", "#e6c068", "#f0e4c8", "#3a8c8c"];

export const colorCycle: ModifierModule<"colorCycle", ColorCycleParams> = {
  kind: "colorCycle",
  label: "Color cycle",
  defaults: () => ({
    colors: [...DEFAULT_PALETTE],
    mode: "cycle",
    seed: 1,
    affect: "fill",
  }),
  apply(instances, params, ctx) {
    const colors = params.colors;
    if (colors.length === 0) return instances;
    return instances.map((inst, i) => {
      const idx =
        params.mode === "random"
          ? Math.floor(ctx.hash(params.seed, i) * colors.length)
          : i % colors.length;
      const c = colors[idx];
      const next: Instance = { ...inst };
      if (params.affect === "fill" || params.affect === "both") next.fill = c;
      if (params.affect === "stroke" || params.affect === "both") next.stroke = c;
      return next;
    });
  },
};
