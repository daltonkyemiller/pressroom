import type { PrimitiveModule } from "../types";
import { randJitter } from "../types";

export type PolygonParams = {
  cx: number;
  cy: number;
  radius: number;
  sides: number; // ≥ 3
  // 0..1 — 1 = regular polygon, <1 = star with inner radius = radius * starInner.
  starInner: number;
  rotation: number;
};

export function polygonPath(p: PolygonParams): string {
  const sides = Math.max(3, Math.floor(p.sides));
  const isStar = p.starInner > 0 && p.starInner < 1;
  const totalPoints = isStar ? sides * 2 : sides;
  const innerR = isStar ? p.radius * p.starInner : p.radius;
  const startAngle = (p.rotation - 90) * (Math.PI / 180); // -90 → point up
  let d = "";
  for (let i = 0; i < totalPoints; i++) {
    const angle = startAngle + (i / totalPoints) * Math.PI * 2;
    const r = isStar ? (i % 2 === 0 ? p.radius : innerR) : p.radius;
    const x = p.cx + Math.cos(angle) * r;
    const y = p.cy + Math.sin(angle) * r;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(3)},${y.toFixed(3)}`;
  }
  d += "Z";
  return d;
}

export const polygon: PrimitiveModule<"polygon", PolygonParams> = {
  kind: "polygon",
  label: "Polygon / star",
  defaults: (c) => ({
    cx: c.x,
    cy: c.y,
    radius: 140,
    sides: 6,
    starInner: 1,
    rotation: 0,
  }),
  randomize: (_, c) => {
    const r = Math.random;
    const isStar = r() < 0.4;
    return {
      cx: randJitter(c.x, 200),
      cy: randJitter(c.y, 200),
      radius: 60 + r() * 180,
      sides: 3 + Math.floor(r() * 9),
      starInner: isStar ? 0.2 + r() * 0.6 : 1,
      rotation: r() < 0.6 ? 0 : Math.floor(r() * 360),
    };
  },
  getCenter: (p) => ({ x: p.cx, y: p.cy }),
  geometry: (p) => `<path d="${polygonPath(p)}" />`,
};
