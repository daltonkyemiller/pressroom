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
import type {
  ModifierKind,
  ModifierParamsByKind,
} from "./modifiers/runtime-registry";

export type Id = number;

// Re-exports so existing call sites can keep importing param types from
// "./types" instead of digging into the registry's per-kind folders.
export type { RectParams } from "./primitives/rect/runtime";
export type { EllipseParams } from "./primitives/ellipse/runtime";
export type { BarStackParams } from "./primitives/barStack/runtime";
export type { WedgeParams } from "./primitives/wedge/runtime";
export type { PolygonParams } from "./primitives/polygon/runtime";
export type { TextParams } from "./primitives/text/runtime";
export type { SvgParams } from "./primitives/svg/runtime";
export type { PrimitiveKind } from "./primitives/runtime-registry";

export type { LinearRepeatParams } from "./modifiers/linearRepeat/runtime";
export type { RadialRepeatParams } from "./modifiers/radialRepeat/runtime";
export type { GridRepeatParams } from "./modifiers/gridRepeat/runtime";
export type { MirrorParams } from "./modifiers/mirror/runtime";
export type { ScatterParams } from "./modifiers/scatter/runtime";
export type { ColorCycleParams } from "./modifiers/colorCycle/runtime";
export type { ClipParams } from "./modifiers/clip/runtime";
export type { BooleanParams } from "./modifiers/boolean/runtime";
export type { PixelateParams } from "./modifiers/pixelate/runtime";
export type { ModifierKind } from "./modifiers/runtime-registry";

export type Primitive = {
  [K in PrimitiveKind]: { kind: K; params: PrimitiveParamsByKind[K] };
}[PrimitiveKind];

export type Modifier = {
  [K in ModifierKind]: {
    id: Id;
    kind: K;
    enabled: boolean;
    params: ModifierParamsByKind[K];
  };
}[ModifierKind];

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
