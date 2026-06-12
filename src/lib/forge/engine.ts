// Engine: expand a node's modifier stack into a flat list of "instances",
// each carrying an accumulated SVG transform, optional clip reference,
// and optional per-instance fill/stroke/opacity overrides (set by color
// modifiers). Render then emits one <g> per instance wrapping the base
// primitive shape.
//
// Per-primitive geometry / center / barStack seeding now lives in the
// primitive registry (`primitives/runtime-registry.ts`). This module
// consults the registry rather than switching on `primitive.kind`.

import { modifierFor } from "./modifiers/runtime-registry";
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
  // Registry lookup replaces the 8-arm switch. The modifier module owns
  // its own apply logic; the engine just supplies a context bag of
  // helpers (compose, hash, recursive expansion, mutable clipDefs).
  const m = modifierFor(mod.kind);
  return m.apply(instances, mod.params as never, {
    node,
    allNodes,
    pivot,
    composeTransform,
    hash,
    hashSigned,
    expandNode,
    clipDefs,
  });
}
