// Engine: expand a node's modifier stack into a flat list of "instances",
// each carrying an accumulated SVG transform, optional clip reference,
// and optional per-instance fill/stroke/opacity overrides (set by color
// modifiers). Render then emits one <g> per instance wrapping the base
// primitive shape.
//
// Per-primitive geometry / center / barStack seeding now lives in the
// primitive registry (`primitives/runtime-registry.ts`). This module
// consults the registry rather than switching on `primitive.kind`.

import { computeBooleanPath, instancesToSvgFragment } from "./boolean";
import { primitiveFor } from "./primitives/runtime-registry";
import type { Modifier, Node, Primitive, PrimitiveNode } from "./types";

// An Instance carries a reference to the primitive being rendered AND its
// resolved style. Groups can produce instances drawn from MULTIPLE
// primitives (one per child), each keeping its own fill/stroke; modifiers
// operate on the flat list uniformly.
export type Instance = {
  primitive: Primitive;
  transform: string;
  clipPathId?: string;
  // Resolved style — always set when seeded; modifiers (colorCycle) may
  // override fill/stroke per-instance after the fact.
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  // When set, this instance renders the supplied SVG path data instead of
  // the primitive. Output of a boolean modifier.
  pathOverride?: string;
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

// Visual center of a primitive — pivot for in-place rotation / scale.
export function getPrimitiveCenter(p: Primitive): { x: number; y: number } {
  const m = primitiveFor(p.kind);
  return m.getCenter(p.params as never);
}

// `a` is the existing instance transform; `b` is the new transform a
// modifier wants to add on top of it. In SVG transform-attribute order,
// leftmost = outermost (applied last when transforming a point), so the
// new (outer) modifier transform must go on the left of the existing one.
//
// Why it matters: when a primitive seeds with `transform = ""` this is
// invisible — both orderings produce just `b`. But once primitives seed
// with their own transforms (barStack's per-bar translate+scale), composing
// a radial rotation on the RIGHT applied the rotation in source coords
// first, then the bar's positioning — which spins each bar around the
// radial center *before* placing it. Putting `b` on the left lets the bar
// position itself first, then the radial rotation orbits the placed bar
// around the radial center, which is what every modifier visually means.
function composeTransform(a: string, b: string): string {
  return a ? `${b} ${a}` : b;
}

// IDs of nodes that are consumed as the target of a boolean modifier with
// hideTarget on — these should be skipped during the doc render so their
// geometry only appears via the boolean result. Walks groups recursively
// so a boolean inside a nested group still hides its target.
export function getBooleanHiddenIds(nodes: readonly Node[]): Set<number> {
  const hidden = new Set<number>();
  function walk(list: readonly Node[]) {
    for (const n of list) {
      if (!n.enabled) continue;
      for (const m of n.modifiers) {
        if (
          m.enabled &&
          m.kind === "boolean" &&
          m.params.hideTarget &&
          m.params.targetNodeId != null
        ) {
          hidden.add(m.params.targetNodeId);
        }
      }
      if (n.kind === "group") walk(n.children);
    }
  }
  walk(nodes);
  return hidden;
}

export function expandNode(node: Node, allNodes: readonly Node[] = []): Expanded {
  const clipDefs: ClipDef[] = [];
  // Seed instances differ for primitive vs group: a primitive node seeds
  // from its own primitive (with barStack contributing N intrinsic bars);
  // a group seeds from the concatenation of its children's expansions.
  let instances: Instance[] = seedInstances(node, allNodes, clipDefs);
  const pivot = getNodePivot(node);

  for (const mod of node.modifiers) {
    if (!mod.enabled) continue;
    instances = applyModifier(instances, mod, clipDefs, node, allNodes, pivot);
  }

  // Group opacity multiplies into each instance's opacity at the very end.
  if (node.kind === "group" && node.opacity !== 1) {
    instances = instances.map((inst) => ({
      ...inst,
      opacity: inst.opacity * node.opacity,
    }));
  }

  return { instances, clipDefs };
}

function seedInstances(
  node: Node,
  allNodes: readonly Node[],
  clipDefs: ClipDef[],
): Instance[] {
  if (node.kind === "group") {
    if (!node.enabled) return [];
    const out: Instance[] = [];
    // Walk children back-to-front so the FIRST child (top of the group in
    // the sidebar) paints LAST and ends up visually in front — matches the
    // top-level "nodes[0] = front" convention. The top-level render in
    // DocSvg / docToSvgString reverses doc.nodes for the same reason.
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i];
      if (!child.enabled) continue;
      const expanded = expandNode(child, allNodes);
      clipDefs.push(...expanded.clipDefs);
      out.push(...expanded.instances);
    }
    return out;
  }
  return seedPrimitiveInstances(node);
}

function seedPrimitiveInstances(node: PrimitiveNode): Instance[] {
  const baseStyle = {
    fill: node.fillEnabled ? node.fill : "none",
    stroke: node.strokeEnabled ? node.stroke : "none",
    strokeWidth: node.strokeEnabled ? node.strokeWidth : 0,
    opacity: node.opacity,
  };
  const m = primitiveFor(node.primitive.kind);
  const seeds = m.seedTransforms
    ? m.seedTransforms(node.primitive.params as never)
    : [{ transform: "" }];
  return seeds.map((s) => ({
    ...s,
    ...baseStyle,
    primitive: node.primitive,
  }));
}

// Pivot point used by per-instance rotation/scale inside modifiers. For a
// primitive node it's the primitive's visual center. For a group it's the
// centroid of the children's pivots — gives a reasonable default for
// "rotate the whole group around its visual middle".
function getNodePivot(node: Node): { x: number; y: number } {
  if (node.kind === "primitive") return getPrimitiveCenter(node.primitive);
  if (node.children.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  let n = 0;
  for (const c of node.children) {
    const p = getNodePivot(c);
    x += p.x;
    y += p.y;
    n++;
  }
  return { x: x / n, y: y / n };
}

function applyModifier(
  instances: Instance[],
  mod: Modifier,
  clipDefs: ClipDef[],
  node: Node,
  allNodes: readonly Node[],
  pivot: { x: number; y: number },
): Instance[] {
  const nodeId = node.id;
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
    case "boolean": {
      if (mod.params.targetNodeId == null) return instances;
      const target = allNodes.find((n) => n.id === mod.params.targetNodeId);
      if (!target || target.id === node.id) return instances;
      // A = this node's primitive applied through every instance accumulated
      //     so far in this stack.
      // B = the target node's full expansion (all of its own modifiers).
      const targetExpanded = expandNode(target, allNodes);
      const selfSvg = instancesToSvgFragment(instances);
      const targetSvg = instancesToSvgFragment(targetExpanded.instances);
      const d = computeBooleanPath(selfSvg, targetSvg, mod.params.op);
      if (!d) return instances;
      // The result is one merged path. Collapse instances to a single
      // identity-transform instance so subsequent modifiers (repeats,
      // scatter, etc.) operate on the boolean output. Inherit style from
      // the first existing instance so the merged path is drawn in the
      // same fill the user picked for the originating node.
      const first = instances[0];
      return [
        {
          primitive:
            first?.primitive ??
            (node.kind === "primitive"
              ? node.primitive
              : { kind: "rect", params: { cx: 0, cy: 0, w: 0, h: 0, rx: 0 } }),
          transform: "",
          fill: first?.fill ?? "#000000",
          stroke: first?.stroke ?? "none",
          strokeWidth: first?.strokeWidth ?? 0,
          opacity: first?.opacity ?? 1,
          pathOverride: d,
        },
      ];
    }
  }
}
