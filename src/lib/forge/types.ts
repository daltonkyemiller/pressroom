// Core types for the forge SVG builder. A document is a flat list of nodes;
// each node has a primitive and a stack of non-destructive modifiers applied
// in order. Adding a new primitive or modifier kind = a new entry in the
// union here plus a render/expand implementation.

export type Id = number;

// ---------- Primitives ----------
// (cx, cy) is the visual center of the rect. Changing w or h grows the shape
// symmetrically — so a grid/repeat stacked on top stays put when the rect's
// size changes, matching the "default symmetric" UX of every other primitive.
export type RectParams = { cx: number; cy: number; w: number; h: number; rx: number };
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
export type SvgParams = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  // Raw SVG markup as the user pasted or uploaded it. Engine parses out
  // the viewBox + inner content at render time so a transform places it
  // at (cx, cy) and scales it to (width, height).
  content: string;
};
export type TextParams = {
  cx: number;
  cy: number;
  content: string;
  size: number;
  // CSS font-family value. Matched against the font registry to find an
  // opentype.Font for boolean ops; falls back to the literal string if not
  // registered (the browser may still render it if it's a system font).
  font: string;
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
  | { kind: "text"; params: TextParams }
  | { kind: "svg"; params: SvgParams };

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
  // When true (default), the target node is skipped during the doc render so
  // its geometry only appears via the boolean result. Otherwise the target
  // would draw on top of the boolean output and visually mask the effect —
  // e.g. subtracting a small circle from a bigger one produces a ring, but
  // the small circle redrawing on top fills the ring's hole right back in.
  hideTarget: boolean;
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
  backgroundEnabled: boolean; // when false, the doc is transparent (no background rect)
  palette: string[]; // shared color palette for the doc
  grain: GrainParams;
  nodes: Node[];
};
