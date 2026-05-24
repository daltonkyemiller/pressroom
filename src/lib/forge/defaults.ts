import type {
  BarStackParams,
  ClipParams,
  ColorCycleParams,
  Doc,
  EllipseParams,
  GrainParams,
  GridRepeatParams,
  LinearRepeatParams,
  Modifier,
  ModifierKind,
  MirrorParams,
  Node,
  PolygonParams,
  Primitive,
  PrimitiveKind,
  RadialRepeatParams,
  RectParams,
  ScatterParams,
  TextParams,
  WedgeParams,
} from "./types";

export const PRIMITIVE_LABELS: Record<PrimitiveKind, string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  barStack: "Bar stack",
  wedge: "Wedge",
  polygon: "Polygon / star",
  text: "Text",
};

export const MODIFIER_LABELS: Record<ModifierKind, string> = {
  linearRepeat: "Linear repeat",
  radialRepeat: "Radial repeat",
  gridRepeat: "Grid repeat",
  mirror: "Mirror",
  scatter: "Scatter",
  colorCycle: "Color cycle",
  clip: "Clip",
};

export const PRIMITIVE_KINDS: PrimitiveKind[] = [
  "barStack",
  "wedge",
  "polygon",
  "rect",
  "ellipse",
  "text",
];
export const MODIFIER_KINDS: ModifierKind[] = [
  "linearRepeat",
  "radialRepeat",
  "gridRepeat",
  "mirror",
  "scatter",
  "colorCycle",
  "clip",
];

const DEFAULT_W = 800;
const DEFAULT_H = 800;
const CENTER = DEFAULT_W / 2;

export const DEFAULT_PALETTE = [
  "#d96b29",
  "#e6c068",
  "#f0e4c8",
  "#3a8c8c",
  "#1a1a1a",
  "#ffffff",
];

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
          cy: CENTER - 160,
          count: 14,
          width: 240,
          height: 12,
          gap: 8,
          taper: -100,
          jitter: 0,
          seed: 1,
          rotation: 0,
        } satisfies BarStackParams,
      };
    case "wedge":
      return {
        kind: "wedge",
        params: {
          cx: CENTER,
          cy: CENTER,
          outerRadius: 200,
          innerRadius: 80,
          startAngle: -45,
          sweep: 90,
        } satisfies WedgeParams,
      };
    case "polygon":
      return {
        kind: "polygon",
        params: {
          cx: CENTER,
          cy: CENTER,
          radius: 140,
          sides: 6,
          starInner: 1,
          rotation: 0,
        } satisfies PolygonParams,
      };
    case "text":
      return {
        kind: "text",
        params: {
          cx: CENTER,
          cy: CENTER,
          content: "FORGE",
          size: 120,
          font: "mondwest",
          anchor: "middle",
          baseline: "middle",
          rotation: 0,
          letterSpacing: 0,
        } satisfies TextParams,
      };
  }
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
    palette: [...DEFAULT_PALETTE],
    grain: { ...DEFAULT_GRAIN },
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
