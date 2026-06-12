// barStack is unique: one primitive node expands to N instances by default,
// one per bar. Each bar carries a transform that scales the base rect's
// width and translates it to the right Y. Modifiers stacked above receive
// these seeded instances as input.

import type { PrimitiveModule } from "../types";
import { randJitter } from "../types";

export type BarStackParams = {
  cx: number; // visual center x of the stack
  cy: number; // visual center y of the stack
  count: number;
  width: number; // max bar width
  height: number; // per-bar height
  gap: number; // gap between bars
  taper: number; // -100..+100 — linear width ramp along the stack
  jitter: number; // 0..100 — per-bar random width variation
  seed: number; // jitter seed
  rotation: number; // 0..360 — rotates the whole stack around (cx, cy)
};

function hash(seed: number, i: number): number {
  let n = ((seed * 374761393) ^ (i * 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 0xffffffff;
}

export const barStack: PrimitiveModule<"barStack", BarStackParams> = {
  kind: "barStack",
  label: "Bar stack",
  defaults: (c) => ({
    cx: c.x,
    cy: c.y - 160,
    count: 14,
    width: 240,
    height: 12,
    gap: 8,
    taper: -100,
    jitter: 0,
    seed: 1,
    rotation: 0,
  }),
  randomize: (_, c) => {
    const r = Math.random;
    return {
      cx: randJitter(c.x, 200),
      cy: randJitter(c.y, 200),
      count: 4 + Math.floor(r() * 24),
      width: 100 + r() * 280,
      height: 4 + r() * 22,
      gap: Math.floor(r() * 18),
      taper: Math.floor(randJitter(0, 200)),
      jitter: r() < 0.5 ? 0 : Math.floor(r() * 80),
      seed: Math.floor(r() * 9999),
      rotation: r() < 0.7 ? 0 : Math.floor(r() * 360),
    };
  },
  getCenter: (p) => ({ x: p.cx, y: p.cy }),
  // Base rect — per-bar transforms (from seedTransforms) position each bar.
  geometry: (p) =>
    `<rect x="${p.cx - p.width / 2}" y="${p.cy - p.height / 2}" width="${p.width}" height="${p.height}" />`,
  seedTransforms: (p) => {
    const out: Array<{ transform: string }> = [];
    const n = Math.max(1, Math.floor(p.count));
    const totalH = n * p.height + (n - 1) * p.gap;
    const topY = p.cy - totalH / 2;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5;
      const taperFactor = 1 - (Math.abs(p.taper) / 100) * (p.taper > 0 ? t : 1 - t);
      let wScale = taperFactor;
      if (p.jitter > 0) {
        wScale *= 1 - hash(p.seed, i) * (p.jitter / 100);
      }
      wScale = Math.max(0.001, wScale);
      const barCenterY = topY + i * (p.height + p.gap) + p.height / 2;
      const dy = barCenterY - p.cy;
      let transform =
        `translate(0 ${dy.toFixed(3)}) translate(${p.cx} ${p.cy}) scale(${wScale.toFixed(5)} 1) translate(${-p.cx} ${-p.cy})`;
      if (p.rotation) {
        // Stack-wide rotation goes outermost so the bars rotate as a unit.
        transform = `rotate(${p.rotation} ${p.cx} ${p.cy}) ${transform}`;
      }
      out.push({ transform });
    }
    return out;
  },
};
