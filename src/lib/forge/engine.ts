// Engine: expand a node's modifier stack into a flat list of "instances",
// each carrying an accumulated SVG transform, optional clip reference,
// and optional per-instance fill/stroke/opacity overrides (set by color
// modifiers). Render then emits one <g> per instance wrapping the base
// primitive shape.

import type { BarStackParams, Modifier, Node, PolygonParams, Primitive } from "./types";

export type Instance = {
  transform: string;
  clipPathId?: string;
  // Per-instance style overrides (set by colorCycle and similar modifiers).
  // Undefined means "inherit from the node's style".
  fill?: string;
  stroke?: string;
  opacity?: number;
};

export type ClipDef = {
  id: string;
  shape: "rect" | "ellipse";
  cx: number;
  cy: number;
  w: number;
  h: number;
  invert: boolean;
};

export type Expanded = {
  instances: Instance[];
  clipDefs: ClipDef[];
};

// Deterministic 32-bit hash → [0, 1). Stable across reloads for a given seed.
export function hash(seed: number, i: number): number {
  let n = ((seed * 374761393) ^ (i * 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 0xffffffff;
}

// Signed in [-1, 1].
export function hashSigned(seed: number, i: number): number {
  return hash(seed, i) * 2 - 1;
}

export function barStackBars(p: BarStackParams): Array<{ x: number; y: number; w: number; h: number }> {
  const bars: Array<{ x: number; y: number; w: number; h: number }> = [];
  const n = Math.max(1, Math.floor(p.count));
  const totalH = n * p.height + (n - 1) * p.gap;
  const topY = p.cy - totalH / 2;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5;
    const taperFactor = 1 - (Math.abs(p.taper) / 100) * (p.taper > 0 ? t : 1 - t);
    let w = p.width * taperFactor;
    if (p.jitter > 0) {
      const r = hash(p.seed, i);
      w *= 1 - r * (p.jitter / 100);
    }
    w = Math.max(0.5, w);
    const x = p.cx - w / 2;
    const y = topY + i * (p.height + p.gap);
    bars.push({ x, y, w, h: p.height });
  }
  return bars;
}

// Build a closed SVG path "d" string for a polygon or star.
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

// Build a closed wedge path. Handles inner radius > 0 (ring segment) and
// sweep angles > 180° (uses large-arc-flag).
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
      // Full disk
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
    // Full annulus = outer circle + inner circle reversed (even-odd fill works
    // via fill-rule, but using two opposite-direction loops keeps the path
    // self-contained for non-zero fill rules too).
    return `M${p.cx - ro},${p.cy} A${ro},${ro} 0 1,0 ${p.cx + ro},${p.cy} A${ro},${ro} 0 1,0 ${p.cx - ro},${p.cy} Z M${p.cx - ri},${p.cy} A${ri},${ri} 0 1,1 ${p.cx + ri},${p.cy} A${ri},${ri} 0 1,1 ${p.cx - ri},${p.cy} Z`;
  }
  return `M${ix1.toFixed(3)},${iy1.toFixed(3)} L${ox1.toFixed(3)},${oy1.toFixed(3)} A${ro},${ro} 0 ${largeArc},${sweepFlag} ${ox2.toFixed(3)},${oy2.toFixed(3)} L${ix2.toFixed(3)},${iy2.toFixed(3)} A${ri},${ri} 0 ${largeArc},${innerSweepFlag} ${ix1.toFixed(3)},${iy1.toFixed(3)} Z`;
}

// Visual center of a primitive — pivot for in-place rotation / scale.
export function getPrimitiveCenter(p: Primitive): { x: number; y: number } {
  switch (p.kind) {
    case "rect":
      return { x: p.params.x + p.params.w / 2, y: p.params.y + p.params.h / 2 };
    case "ellipse":
      return { x: p.params.cx, y: p.params.cy };
    case "barStack":
      return { x: p.params.cx, y: p.params.cy };
    case "wedge":
      return { x: p.params.cx, y: p.params.cy };
    case "polygon":
      return { x: p.params.cx, y: p.params.cy };
    case "text":
      return { x: p.params.cx, y: p.params.cy };
  }
}

function composeTransform(a: string, b: string): string {
  return a ? `${a} ${b}` : b;
}

export function expandNode(node: Node): Expanded {
  const pivot = getPrimitiveCenter(node.primitive);
  let instances: Instance[] = [{ transform: "" }];
  const clipDefs: ClipDef[] = [];

  for (const mod of node.modifiers) {
    if (!mod.enabled) continue;
    instances = applyModifier(instances, mod, clipDefs, node.id, pivot);
  }

  return { instances, clipDefs };
}

function applyModifier(
  instances: Instance[],
  mod: Modifier,
  clipDefs: ClipDef[],
  nodeId: number,
  pivot: { x: number; y: number },
): Instance[] {
  switch (mod.kind) {
    case "linearRepeat": {
      const out: Instance[] = [];
      const n = Math.max(1, Math.floor(mod.params.count));
      for (const inst of instances) {
        for (let i = 0; i < n; i++) {
          const angle = i * mod.params.dRotate;
          const s = 1 + i * mod.params.dScale * 0.01;
          const t = `translate(${i * mod.params.dx} ${i * mod.params.dy}) rotate(${angle} ${pivot.x} ${pivot.y}) translate(${pivot.x} ${pivot.y}) scale(${s}) translate(${-pivot.x} ${-pivot.y})`;
          out.push({ ...inst, transform: composeTransform(inst.transform, t) });
        }
      }
      return out;
    }
    case "radialRepeat": {
      const out: Instance[] = [];
      const n = Math.max(1, Math.floor(mod.params.count));
      for (const inst of instances) {
        for (let i = 0; i < n; i++) {
          const angle = (i / n) * mod.params.arc;
          const t = `rotate(${angle} ${mod.params.cx} ${mod.params.cy})`;
          out.push({ ...inst, transform: composeTransform(inst.transform, t) });
        }
      }
      return out;
    }
    case "gridRepeat": {
      const out: Instance[] = [];
      const nx = Math.max(1, Math.floor(mod.params.countX));
      const ny = Math.max(1, Math.floor(mod.params.countY));
      // Center the grid on the pivot so adding a grid doesn't fling the
      // shape into the corner.
      const offsetX = -((nx - 1) * mod.params.dx) / 2;
      const offsetY = -((ny - 1) * mod.params.dy) / 2;
      for (const inst of instances) {
        for (let j = 0; j < ny; j++) {
          for (let i = 0; i < nx; i++) {
            const stagger = j % 2 === 1 ? mod.params.staggerY : 0;
            const tx = offsetX + i * mod.params.dx + stagger;
            const ty = offsetY + j * mod.params.dy;
            const angle = (i + j) * mod.params.cellRotate;
            const t = `translate(${tx} ${ty}) rotate(${angle} ${pivot.x} ${pivot.y})`;
            out.push({ ...inst, transform: composeTransform(inst.transform, t) });
          }
        }
      }
      return out;
    }
    case "mirror": {
      const out: Instance[] = [];
      const { axis, center } = mod.params;
      const reflect =
        axis === "x"
          ? `translate(0 ${2 * center}) scale(1 -1)`
          : `translate(${2 * center} 0) scale(-1 1)`;
      for (const inst of instances) {
        out.push(inst);
        out.push({ ...inst, transform: composeTransform(inst.transform, reflect) });
      }
      return out;
    }
    case "scatter": {
      // Adds per-instance random offset/rotation/scale to existing instances.
      // Doesn't multiply count — operates on whatever's already been produced.
      return instances.map((inst, i) => {
        const r1 = hashSigned(mod.params.seed, i * 4 + 0);
        const r2 = hashSigned(mod.params.seed, i * 4 + 1);
        const r3 = hashSigned(mod.params.seed, i * 4 + 2);
        const r4 = hashSigned(mod.params.seed, i * 4 + 3);
        const dx = r1 * mod.params.offsetX;
        const dy = r2 * mod.params.offsetY;
        const dAngle = r3 * mod.params.rotation;
        const s = 1 + r4 * mod.params.scale;
        const t = `translate(${dx.toFixed(3)} ${dy.toFixed(3)}) rotate(${dAngle.toFixed(3)} ${pivot.x} ${pivot.y}) translate(${pivot.x} ${pivot.y}) scale(${s.toFixed(4)}) translate(${-pivot.x} ${-pivot.y})`;
        return { ...inst, transform: composeTransform(inst.transform, t) };
      });
    }
    case "colorCycle": {
      const colors = mod.params.colors;
      if (colors.length === 0) return instances;
      return instances.map((inst, i) => {
        const idx =
          mod.params.mode === "random"
            ? Math.floor(hash(mod.params.seed, i) * colors.length)
            : i % colors.length;
        const c = colors[idx];
        const next: Instance = { ...inst };
        if (mod.params.affect === "fill" || mod.params.affect === "both") next.fill = c;
        if (mod.params.affect === "stroke" || mod.params.affect === "both") next.stroke = c;
        return next;
      });
    }
    case "clip": {
      const id = `clip-${nodeId}-${clipDefs.length}`;
      clipDefs.push({ id, ...mod.params });
      return instances.map((inst) => ({ ...inst, clipPathId: id }));
    }
  }
}
