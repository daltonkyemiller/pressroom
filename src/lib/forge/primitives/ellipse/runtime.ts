import type { PrimitiveModule } from "../types";
import { randJitter } from "../types";

export type EllipseParams = { cx: number; cy: number; rx: number; ry: number };

export const ellipse: PrimitiveModule<"ellipse", EllipseParams> = {
  kind: "ellipse",
  label: "Ellipse",
  defaults: (c) => ({ cx: c.x, cy: c.y, rx: 100, ry: 100 }),
  randomize: (_, c) => {
    const r = Math.random;
    const rx = 30 + r() * 250;
    const ry = r() < 0.5 ? rx : 30 + r() * 250;
    return { cx: randJitter(c.x, 240), cy: randJitter(c.y, 240), rx, ry };
  },
  getCenter: (p) => ({ x: p.cx, y: p.cy }),
  geometry: (p) => `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" />`,
};
