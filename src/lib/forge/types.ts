// Core types for the forge SVG builder. A document is a flat list of nodes;
// each node has a primitive and a stack of non-destructive modifiers applied
// in order. Adding a new primitive or modifier kind = a new entry in the
// union here plus a render/expand implementation.

export type Id = number;

// ---------- Primitives ----------
export type RectParams = { x: number; y: number; w: number; h: number; rx: number };
export type EllipseParams = { cx: number; cy: number; rx: number; ry: number };
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
export type WedgeParams = {
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number; // 0 = solid pie slice, >0 = ring segment
  startAngle: number; // degrees, 0 = pointing right
  sweep: number; // degrees, positive = clockwise
};
export type PolygonParams = {
  cx: number;
  cy: number;
  radius: number;
  sides: number; // ≥ 3
  starInner: number; // 0..1 — 1 = regular polygon, <1 = star with inner radius = radius * starInner
  rotation: number;
};
export type TextParams = {
  cx: number;
  cy: number;
  content: string;
  size: number;
  font: "mondwest" | "geist-pixel" | "neue-bit" | "sans";
  anchor: "start" | "middle" | "end";
  baseline: "hanging" | "middle" | "alphabetic";
  rotation: number;
  letterSpacing: number;
};

export type Primitive =
  | { kind: "rect"; params: RectParams }
  | { kind: "ellipse"; params: EllipseParams }
  | { kind: "barStack"; params: BarStackParams }
  | { kind: "wedge"; params: WedgeParams }
  | { kind: "polygon"; params: PolygonParams }
  | { kind: "text"; params: TextParams };

export type PrimitiveKind = Primitive["kind"];

// ---------- Modifiers ----------
export type LinearRepeatParams = {
  count: number;
  dx: number;
  dy: number;
  dRotate: number; // degrees added per step
  dScale: number; // multiplicative scale delta per step (0 = no change)
};
export type RadialRepeatParams = {
  count: number;
  cx: number;
  cy: number;
  arc: number; // total degrees swept (360 = full circle)
};
export type GridRepeatParams = {
  countX: number;
  countY: number;
  dx: number;
  dy: number;
  staggerY: number; // x-offset added to odd rows (brick pattern when > 0)
  cellRotate: number; // degrees added per cell index (i + j)
};
export type MirrorParams = {
  axis: "x" | "y";
  center: number;
};
export type ScatterParams = {
  offsetX: number; // max abs random x offset
  offsetY: number; // max abs random y offset
  rotation: number; // max abs random rotation in degrees
  scale: number; // 0..1 — random scale variation (1 ± scale)
  seed: number;
};
export type ColorCycleParams = {
  colors: string[]; // explicit color list; bypass when empty (no override)
  mode: "cycle" | "random"; // cycle = i mod n, random = seeded random pick
  seed: number;
  affect: "fill" | "stroke" | "both";
};
export type ClipParams = {
  shape: "rect" | "ellipse";
  cx: number;
  cy: number;
  w: number;
  h: number;
  invert: boolean;
};
export type BooleanParams = {
  op: "union" | "subtract" | "intersect" | "exclude";
  targetNodeId: number | null; // when null, the modifier is a no-op
};

export type Modifier =
  | { id: Id; kind: "linearRepeat"; enabled: boolean; params: LinearRepeatParams }
  | { id: Id; kind: "radialRepeat"; enabled: boolean; params: RadialRepeatParams }
  | { id: Id; kind: "gridRepeat"; enabled: boolean; params: GridRepeatParams }
  | { id: Id; kind: "mirror"; enabled: boolean; params: MirrorParams }
  | { id: Id; kind: "scatter"; enabled: boolean; params: ScatterParams }
  | { id: Id; kind: "colorCycle"; enabled: boolean; params: ColorCycleParams }
  | { id: Id; kind: "clip"; enabled: boolean; params: ClipParams }
  | { id: Id; kind: "boolean"; enabled: boolean; params: BooleanParams };

export type ModifierKind = Modifier["kind"];

// ---------- Node + Doc ----------
export type Node = {
  id: Id;
  name: string;
  enabled: boolean;
  primitive: Primitive;
  fill: string;
  fillEnabled: boolean; // when false, emits fill="none" while keeping the color memorized
  stroke: string;
  strokeEnabled: boolean; // when false, emits stroke="none"
  strokeWidth: number;
  opacity: number;
  modifiers: Modifier[];
};

export type GrainParams = {
  enabled: boolean;
  amount: number; // 0..1 — opacity of the grain layer
  frequency: number; // baseFrequency for feTurbulence
  octaves: number;
  seed: number;
  monochrome: boolean;
};

export type Doc = {
  width: number;
  height: number;
  background: string;
  palette: string[]; // shared color palette for the doc
  grain: GrainParams;
  nodes: Node[];
};
