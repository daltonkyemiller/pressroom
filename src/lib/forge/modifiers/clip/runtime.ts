import type { ModifierModule } from "../types";

export type ClipParams = {
  shape: "rect" | "ellipse";
  cx: number;
  cy: number;
  w: number;
  h: number;
  invert: boolean;
};

export const clip: ModifierModule<"clip", ClipParams> = {
  kind: "clip",
  label: "Clip",
  defaults: (c) => ({
    shape: "ellipse",
    cx: c.x,
    cy: c.y,
    w: 500,
    h: 500,
    invert: false,
  }),
  apply(instances, params, ctx) {
    const id = `clip-${ctx.node.id}-${ctx.clipDefs.length}`;
    ctx.clipDefs.push({ id, ...params });
    return instances.map((inst) => ({ ...inst, clipPathId: id }));
  },
};
