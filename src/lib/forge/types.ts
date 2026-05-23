// Core types for the forge SVG builder. A document is a flat list of nodes;
// each node has a primitive and a stack of non-destructive modifiers applied
// in order. Adding a new primitive or modifier kind = a new entry in the
// union here plus a render/expand implementation.

export type Id = number;

// ---------- Primitives ----------
export type RectParams = { x: number; y: number; w: number; h: number; rx: number };
export type EllipseParams = { cx: number; cy: number; rx: number; ry: number };
export type BarStackParams = {
  cx: number; // anchor x (bars centered on this)
  cy: number; // anchor y (top of first bar)
  count: number;
  width: number; // max bar width
  height: number; // per-bar height
  gap: number; // gap between bars
  taper: number; // -100..+100 — linear width ramp along the stack
  jitter: number; // 0..100 — per-bar random width variation
  seed: number; // jitter seed
  rotation: number; // 0..360 — rotates the whole stack around (cx, cy)
};

export type Primitive =
  | { kind: "rect"; params: RectParams }
  | { kind: "ellipse"; params: EllipseParams }
  | { kind: "barStack"; params: BarStackParams };

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
export type MirrorParams = {
  axis: "x" | "y";
  center: number; // axis position in document coords
};
export type ClipParams = {
  shape: "rect" | "ellipse";
  cx: number;
  cy: number;
  w: number;
  h: number;
  invert: boolean; // when true, keep what's OUTSIDE the clip
};

export type Modifier =
  | { id: Id; kind: "linearRepeat"; enabled: boolean; params: LinearRepeatParams }
  | { id: Id; kind: "radialRepeat"; enabled: boolean; params: RadialRepeatParams }
  | { id: Id; kind: "mirror"; enabled: boolean; params: MirrorParams }
  | { id: Id; kind: "clip"; enabled: boolean; params: ClipParams };

export type ModifierKind = Modifier["kind"];

// ---------- Node + Doc ----------
export type Node = {
  id: Id;
  name: string;
  enabled: boolean;
  primitive: Primitive;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  modifiers: Modifier[];
};

export type Doc = {
  width: number;
  height: number;
  background: string;
  nodes: Node[];
};
