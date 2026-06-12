import type { PrimitiveModule } from "../types";
import { randJitter } from "../types";

export type WedgeParams = {
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number; // 0 = solid pie slice, >0 = ring segment
  startAngle: number; // degrees, 0 = pointing right
  sweep: number; // degrees, positive = clockwise
};

// Closed-path string for a wedge. Handles inner radius > 0 (ring segment)
// and sweep angles > 180° (uses large-arc-flag).
export function wedgePath(p: {
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number;
  startAngle: number;
  sweep: number;
}): string {
  const startRad = (p.startAngle * Math.PI) / 180;
  const endRad = ((p.startAngle + p.sweep) * Math.PI) / 180;
  const ro = Math.max(0, p.outerRadius);
  const ri = Math.max(0, Math.min(ro, p.innerRadius));
  const absSweep = Math.abs(p.sweep);
  const largeArc = absSweep > 180 ? 1 : 0;
  const sweepFlag = p.sweep >= 0 ? 1 : 0;
  const ox1 = p.cx + Math.cos(startRad) * ro;
  const oy1 = p.cy + Math.sin(startRad) * ro;
  const ox2 = p.cx + Math.cos(endRad) * ro;
  const oy2 = p.cy + Math.sin(endRad) * ro;
  if (ri <= 0) {
    if (absSweep >= 360) {
      return `M${p.cx - ro},${p.cy} A${ro},${ro} 0 1,0 ${p.cx + ro},${p.cy} A${ro},${ro} 0 1,0 ${p.cx - ro},${p.cy} Z`;
    }
    return `M${p.cx.toFixed(3)},${p.cy.toFixed(3)} L${ox1.toFixed(3)},${oy1.toFixed(3)} A${ro},${ro} 0 ${largeArc},${sweepFlag} ${ox2.toFixed(3)},${oy2.toFixed(3)} Z`;
  }
  const ix1 = p.cx + Math.cos(startRad) * ri;
  const iy1 = p.cy + Math.sin(startRad) * ri;
  const ix2 = p.cx + Math.cos(endRad) * ri;
  const iy2 = p.cy + Math.sin(endRad) * ri;
  const innerSweepFlag = p.sweep >= 0 ? 0 : 1;
  if (absSweep >= 360) {
    // Full annulus = outer + inner loops in opposite directions so non-zero
    // fill rules also render the donut correctly.
    return `M${p.cx - ro},${p.cy} A${ro},${ro} 0 1,0 ${p.cx + ro},${p.cy} A${ro},${ro} 0 1,0 ${p.cx - ro},${p.cy} Z M${p.cx - ri},${p.cy} A${ri},${ri} 0 1,1 ${p.cx + ri},${p.cy} A${ri},${ri} 0 1,1 ${p.cx - ri},${p.cy} Z`;
  }
  return `M${ix1.toFixed(3)},${iy1.toFixed(3)} L${ox1.toFixed(3)},${oy1.toFixed(3)} A${ro},${ro} 0 ${largeArc},${sweepFlag} ${ox2.toFixed(3)},${oy2.toFixed(3)} L${ix2.toFixed(3)},${iy2.toFixed(3)} A${ri},${ri} 0 ${largeArc},${innerSweepFlag} ${ix1.toFixed(3)},${iy1.toFixed(3)} Z`;
}

export const wedge: PrimitiveModule<"wedge", WedgeParams> = {
  kind: "wedge",
  label: "Wedge",
  defaults: (c) => ({
    cx: c.x,
    cy: c.y,
    outerRadius: 200,
    innerRadius: 80,
    startAngle: -45,
    sweep: 90,
  }),
  randomize: (_, c) => {
    const r = Math.random;
    const ro = 80 + r() * 220;
    const ri = r() < 0.5 ? 0 : r() * (ro - 20);
    return {
      cx: randJitter(c.x, 200),
      cy: randJitter(c.y, 200),
      outerRadius: ro,
      innerRadius: ri,
      startAngle: Math.floor(-180 + r() * 360),
      sweep: Math.floor(30 + r() * 270),
    };
  },
  getCenter: (p) => ({ x: p.cx, y: p.cy }),
  geometry: (p) => `<path d="${wedgePath(p)}" />`,
};
