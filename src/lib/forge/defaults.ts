import {
  PRIMITIVES_RUNTIME,
  primitiveFor,
  type PrimitiveKind,
} from "./primitives/runtime-registry";
import type {
  ClipParams,
  ColorCycleParams,
  Doc,
  GrainParams,
  GridRepeatParams,
  LinearRepeatParams,
  Modifier,
  ModifierKind,
  MirrorParams,
  Node,
  Primitive,
  PrimitiveNode,
  RadialRepeatParams,
  ScatterParams,
} from "./types";

// Label record derived from the primitive registry so adding a new kind
// doesn't need a parallel update here.
export const PRIMITIVE_LABELS = Object.fromEntries(
  (Object.keys(PRIMITIVES_RUNTIME) as PrimitiveKind[]).map((k) => [k, PRIMITIVES_RUNTIME[k].label]),
) as Record<PrimitiveKind, string>;

export const MODIFIER_LABELS: Record<ModifierKind, string> = {
  linearRepeat: "Linear repeat",
  radialRepeat: "Radial repeat",
  gridRepeat: "Grid repeat",
  mirror: "Mirror",
  scatter: "Scatter",
  colorCycle: "Color cycle",
  clip: "Clip",
  boolean: "Boolean",
};

export { PRIMITIVE_KINDS } from "./primitives/runtime-registry";

export const MODIFIER_KINDS: ModifierKind[] = [
  "linearRepeat",
  "radialRepeat",
  "gridRepeat",
  "mirror",
  "scatter",
  "colorCycle",
  "clip",
  "boolean",
];

const DEFAULT_W = 800;
const DEFAULT_H = 800;
const CENTER = DEFAULT_W / 2;
const CENTER_POINT = { x: CENTER, y: CENTER };

export const DEFAULT_PALETTE = [
  "#d96b29",
  "#e6c068",
  "#f0e4c8",
  "#3a8c8c",
  "#1a1a1a",
  "#ffffff",
];

export function makePrimitive(kind: PrimitiveKind): Primitive {
  const m = primitiveFor(kind);
  return { kind, params: m.defaults(CENTER_POINT) } as Primitive;
}

export function makeModifier(
  kind: ModifierKind,
  id: number,
  center: { x: number; y: number } = { x: CENTER, y: CENTER },
): Modifier {
  switch (kind) {
    case "linearRepeat":
      return {
        id,
        kind,
        enabled: true,
        params: {
          count: 3,
          dx: 30,
          dy: 0,
          dRotate: 0,
          dScale: 0,
        } satisfies LinearRepeatParams,
      };
    case "radialRepeat":
      return {
        id,
        kind,
        enabled: true,
        params: {
          count: 4,
          cx: center.x,
          cy: center.y,
          arc: 360,
        } satisfies RadialRepeatParams,
      };
    case "gridRepeat":
      return {
        id,
        kind,
        enabled: true,
        params: {
          countX: 4,
          countY: 4,
          dx: 80,
          dy: 80,
          staggerY: 0,
          cellRotate: 0,
        } satisfies GridRepeatParams,
      };
    case "mirror":
      return {
        id,
        kind,
        enabled: true,
        params: { axis: "y", center: center.x } satisfies MirrorParams,
      };
    case "scatter":
      return {
        id,
        kind,
        enabled: true,
        params: {
          offsetX: 20,
          offsetY: 20,
          rotation: 15,
          scale: 0.1,
          seed: 1,
        } satisfies ScatterParams,
      };
    case "colorCycle":
      return {
        id,
        kind,
        enabled: true,
        params: {
          colors: [...DEFAULT_PALETTE.slice(0, 4)],
          mode: "cycle",
          seed: 1,
          affect: "fill",
        } satisfies ColorCycleParams,
      };
    case "clip":
      return {
        id,
        kind,
        enabled: true,
        params: {
          shape: "ellipse",
          cx: center.x,
          cy: center.y,
          w: 500,
          h: 500,
          invert: false,
        } satisfies ClipParams,
      };
    case "boolean":
      return {
        id,
        kind,
        enabled: true,
        params: { op: "subtract", targetNodeId: null, hideTarget: true },
      };
  }
}

let _nodeId = 1;
let _modId = 1;
export function nextNodeId(): number {
  return _nodeId++;
}
export function nextModId(): number {
  return _modId++;
}

// Reroll primitive params within sensible visual bounds. The per-kind
// shape (which params to touch, what bounds) lives in each primitive's
// runtime module — this is just the registry lookup.
function randomizePrimitive(primitive: Primitive): Primitive {
  const m = primitiveFor(primitive.kind);
  const params = m.randomize(primitive.params as never, CENTER_POINT);
  return { kind: primitive.kind, params } as Primitive;
}

export function randomizeNode(node: Node, palette: string[]): Node {
  const r = Math.random;
  // Reroll seeds on modifiers that use them so the random output actually
  // looks different each time. Works for both primitive and group nodes.
  const modifiers = node.modifiers.map((m) => {
    if (m.kind === "scatter") {
      return { ...m, params: { ...m.params, seed: Math.floor(r() * 9999) } };
    }
    if (m.kind === "colorCycle" && m.params.mode === "random") {
      return { ...m, params: { ...m.params, seed: Math.floor(r() * 9999) } };
    }
    return m;
  });
  if (node.kind === "group") {
    // Recurse into children so a "randomize group" rerolls everything below.
    return {
      ...node,
      modifiers,
      children: node.children.map((c) => randomizeNode(c, palette)),
    };
  }
  const primitive = randomizePrimitive(node.primitive);
  const fill =
    palette.length > 0 ? palette[Math.floor(r() * palette.length)] : node.fill;
  return { ...node, primitive, fill, modifiers };
}

export function makeNode(kind: PrimitiveKind, id: number): PrimitiveNode {
  return {
    id,
    kind: "primitive",
    name: PRIMITIVE_LABELS[kind],
    enabled: true,
    primitive: makePrimitive(kind),
    fill: "#d96b29",
    fillEnabled: true,
    stroke: "#000000",
    strokeEnabled: false,
    strokeWidth: 0,
    opacity: 1,
    modifiers: [],
  };
}

export function makeGroup(id: number, children: Node[] = []): Node {
  return {
    id,
    kind: "group",
    name: "Group",
    enabled: true,
    children,
    opacity: 1,
    modifiers: [],
  };
}

export const DEFAULT_GRAIN: GrainParams = {
  enabled: false,
  amount: 0.18,
  frequency: 0.9,
  octaves: 2,
  seed: 7,
  monochrome: true,
};

export function makeDefaultDoc(): Doc {
  return {
    width: DEFAULT_W,
    height: DEFAULT_H,
    background: "#1a1a1a",
    backgroundEnabled: true,
    palette: [...DEFAULT_PALETTE],
    grain: { ...DEFAULT_GRAIN },
    nodes: [
      {
        id: nextNodeId(),
        kind: "primitive",
        name: "Bar stack",
        enabled: true,
        primitive: makePrimitive("barStack"),
        fill: "#d96b29",
        fillEnabled: true,
        stroke: "#000000",
        strokeEnabled: false,
        strokeWidth: 0,
        opacity: 1,
        modifiers: [
          {
            id: nextModId(),
            kind: "radialRepeat",
            enabled: true,
            params: {
              count: 4,
              cx: CENTER,
              cy: CENTER,
              arc: 360,
            },
          },
        ],
      },
    ],
  };
}
