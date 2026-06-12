// Core types for the forge SVG builder. A document is a flat list of nodes;
// each node has a primitive and a stack of non-destructive modifiers applied
// in order.
//
// Adding a new primitive: create `lib/forge/primitives/<kind>/runtime.ts`
// and add an entry to `primitives/runtime-registry.ts`. The Primitive union
// below is derived from that registry — TypeScript catches missing kinds.

import type {
  PrimitiveKind,
  PrimitiveParamsByKind,
} from "./primitives/runtime-registry";

export type Id = number;

// Re-exports so existing call sites (forge-app, controls, prefabs, export)
// can keep importing param types from "./types" instead of digging into
// the registry's per-kind folders.
export type { RectParams } from "./primitives/rect/runtime";
export type { EllipseParams } from "./primitives/ellipse/runtime";
export type { BarStackParams } from "./primitives/barStack/runtime";
export type { WedgeParams } from "./primitives/wedge/runtime";
export type { PolygonParams } from "./primitives/polygon/runtime";
export type { TextParams } from "./primitives/text/runtime";
export type { SvgParams } from "./primitives/svg/runtime";
export type { PrimitiveKind } from "./primitives/runtime-registry";

export type Primitive = {
  [K in PrimitiveKind]: { kind: K; params: PrimitiveParamsByKind[K] };
}[PrimitiveKind];

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
// A node is either a primitive (one shape with style + modifier stack) or
// a group that holds child nodes and applies its own modifier stack on top
// of the combined children. Groups can nest groups, so the doc is a tree.
//
// All nodes share `kind` as the discriminator and the common fields
// `id`, `name`, `enabled`, `modifiers`, `opacity`.

export type PrimitiveNode = {
  id: Id;
  kind: "primitive";
  name: string;
  enabled: boolean;
  primitive: Primitive;
  fill: string;
  fillEnabled: boolean;
  stroke: string;
  strokeEnabled: boolean;
  strokeWidth: number;
  opacity: number;
  modifiers: Modifier[];
};

export type GroupNode = {
  id: Id;
  kind: "group";
  name: string;
  enabled: boolean;
  children: Node[];
  opacity: number;
  modifiers: Modifier[];
};

export type Node = PrimitiveNode | GroupNode;

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
