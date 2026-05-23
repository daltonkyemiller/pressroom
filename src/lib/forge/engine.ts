// Engine: expand a node's modifier stack into a flat list of "instances",
// each carrying an accumulated SVG transform and optional clip reference.
// Render then emits one <g> per instance wrapping the base primitive shape.

import type { BarStackParams, Modifier, Node } from "./types";

export type Instance = {
  // SVG transform attribute, accumulated from the outside in.
  transform: string;
  // ID of a <clipPath> def to attach via clip-path; the runner registers
  // the def shape data once per modifier and references it from instances.
  clipPathId?: string;
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

// Deterministic 32-bit hash → [0, 1). Used for jitter so renders are stable
// across reloads as long as the seed doesn't change.
function hash(seed: number, i: number): number {
  let n = ((seed * 374761393) ^ (i * 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 0xffffffff;
}

export function barStackBars(p: BarStackParams): Array<{ x: number; y: number; w: number; h: number }> {
  const bars: Array<{ x: number; y: number; w: number; h: number }> = [];
  const n = Math.max(1, Math.floor(p.count));
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5;
    // taper: +100 → wide at top tapering to narrow at bottom; -100 reverses.
    const taperFactor = 1 - (Math.abs(p.taper) / 100) * (p.taper > 0 ? t : 1 - t);
    let w = p.width * taperFactor;
    if (p.jitter > 0) {
      const r = hash(p.seed, i);
      w *= 1 - r * (p.jitter / 100);
    }
    w = Math.max(0.5, w);
    const x = p.cx - w / 2;
    const y = p.cy + i * (p.height + p.gap);
    bars.push({ x, y, w, h: p.height });
  }
  return bars;
}

function composeTransform(a: string, b: string): string {
  return a ? `${a} ${b}` : b;
}

export function expandNode(node: Node): Expanded {
  let instances: Instance[] = [{ transform: "" }];
  const clipDefs: ClipDef[] = [];

  for (const mod of node.modifiers) {
    if (!mod.enabled) continue;
    instances = applyModifier(instances, mod, clipDefs, node.id);
  }

  return { instances, clipDefs };
}

function applyModifier(
  instances: Instance[],
  mod: Modifier,
  clipDefs: ClipDef[],
  nodeId: number,
): Instance[] {
  switch (mod.kind) {
    case "linearRepeat": {
      const out: Instance[] = [];
      const n = Math.max(1, Math.floor(mod.params.count));
      for (const inst of instances) {
        for (let i = 0; i < n; i++) {
          const t = `translate(${i * mod.params.dx} ${i * mod.params.dy}) rotate(${
            i * mod.params.dRotate
          }) scale(${1 + i * mod.params.dScale * 0.01})`;
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
    case "mirror": {
      const out: Instance[] = [];
      const { axis, center } = mod.params;
      // Mirror across y=center (axis "x" flips vertically) or x=center
      // (axis "y" flips horizontally). Pre-compose so each existing
      // instance gets a sibling reflected copy.
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
    case "clip": {
      const id = `clip-${nodeId}-${clipDefs.length}`;
      clipDefs.push({ id, ...mod.params });
      return instances.map((inst) => ({ ...inst, clipPathId: id }));
    }
  }
}
