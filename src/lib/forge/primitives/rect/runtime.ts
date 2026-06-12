import type { PrimitiveModule } from "../types";
import { randJitter } from "../types";

export type RectParams = { cx: number; cy: number; w: number; h: number; rx: number };

export const rect: PrimitiveModule<"rect", RectParams> = {
  kind: "rect",
  label: "Rectangle",
  defaults: (c) => ({ cx: c.x, cy: c.y, w: 160, h: 160, rx: 0 }),
  randomize: (_, c) => {
    const r = Math.random;
    return {
      cx: randJitter(c.x, 240),
      cy: randJitter(c.y, 240),
      w: 50 + r() * 400,
      h: 50 + r() * 400,
      rx: r() < 0.5 ? 0 : r() * 60,
    };
  },
  getCenter: (p) => ({ x: p.cx, y: p.cy }),
  geometry: (p) => {
    const rx = p.rx > 0 ? ` rx="${p.rx}"` : "";
    return `<rect x="${p.cx - p.w / 2}" y="${p.cy - p.h / 2}" width="${p.w}" height="${p.h}"${rx} />`;
  },
};
