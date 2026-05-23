import type {
  BarStackParams,
  ClipParams,
  Doc,
  EllipseParams,
  LinearRepeatParams,
  Modifier,
  ModifierKind,
  MirrorParams,
  Node,
  Primitive,
  PrimitiveKind,
  RadialRepeatParams,
  RectParams,
} from "./types";

export const PRIMITIVE_LABELS: Record<PrimitiveKind, string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  barStack: "Bar stack",
};

export const MODIFIER_LABELS: Record<ModifierKind, string> = {
  linearRepeat: "Linear repeat",
  radialRepeat: "Radial repeat",
  mirror: "Mirror",
  clip: "Clip",
};

export const PRIMITIVE_KINDS: PrimitiveKind[] = ["barStack", "rect", "ellipse"];
export const MODIFIER_KINDS: ModifierKind[] = [
  "linearRepeat",
  "radialRepeat",
  "mirror",
  "clip",
];

const DEFAULT_W = 800;
const DEFAULT_H = 800;
const CENTER = DEFAULT_W / 2;

export function makePrimitive(kind: PrimitiveKind): Primitive {
  switch (kind) {
    case "rect":
      return {
        kind: "rect",
        params: {
          x: CENTER - 80,
          y: CENTER - 80,
          w: 160,
          h: 160,
          rx: 0,
        } satisfies RectParams,
      };
    case "ellipse":
      return {
        kind: "ellipse",
        params: { cx: CENTER, cy: CENTER, rx: 100, ry: 100 } satisfies EllipseParams,
      };
    case "barStack":
      return {
        kind: "barStack",
        params: {
          cx: CENTER,
          cy: CENTER - 180,
          count: 14,
          width: 240,
          height: 12,
          gap: 8,
          taper: 100,
          jitter: 0,
          seed: 1,
          rotation: 0,
        } satisfies BarStackParams,
      };
  }
}

export function makeModifier(kind: ModifierKind, id: number): Modifier {
  switch (kind) {
    case "linearRepeat":
      return {
        id,
        kind,
        enabled: true,
        params: { count: 3, dx: 30, dy: 0, dRotate: 0, dScale: 0 } satisfies LinearRepeatParams,
      };
    case "radialRepeat":
      return {
        id,
        kind,
        enabled: true,
        params: {
          count: 4,
          cx: CENTER,
          cy: CENTER,
          arc: 360,
        } satisfies RadialRepeatParams,
      };
    case "mirror":
      return {
        id,
        kind,
        enabled: true,
        params: { axis: "y", center: CENTER } satisfies MirrorParams,
      };
    case "clip":
      return {
        id,
        kind,
        enabled: true,
        params: {
          shape: "ellipse",
          cx: CENTER,
          cy: CENTER,
          w: 500,
          h: 500,
          invert: false,
        } satisfies ClipParams,
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

export function makeNode(kind: PrimitiveKind, id: number): Node {
  return {
    id,
    name: PRIMITIVE_LABELS[kind],
    enabled: true,
    primitive: makePrimitive(kind),
    fill: "#d96b29",
    stroke: "#000000",
    strokeWidth: 0,
    opacity: 1,
    modifiers: [],
  };
}

// Default doc that immediately shows what the modifier stack can do:
// one tapered bar stack repeated radially four times, producing a totem cross.
export function makeDefaultDoc(): Doc {
  return {
    width: DEFAULT_W,
    height: DEFAULT_H,
    background: "#1a1a1a",
    nodes: [
      {
        id: nextNodeId(),
        name: "Bar stack",
        enabled: true,
        primitive: makePrimitive("barStack"),
        fill: "#d96b29",
        stroke: "#000000",
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
