// Source of truth for forge primitive kinds. See ADR-0001.

import type { PrimitiveModule } from "./types";

import { rect, type RectParams } from "./rect/runtime";
import { ellipse, type EllipseParams } from "./ellipse/runtime";
import { barStack, type BarStackParams } from "./barStack/runtime";
import { wedge, type WedgeParams } from "./wedge/runtime";
import { polygon, type PolygonParams } from "./polygon/runtime";
import { text, type TextParams } from "./text/runtime";
import { svg, type SvgParams } from "./svg/runtime";

export const PRIMITIVES_RUNTIME = {
  rect,
  ellipse,
  barStack,
  wedge,
  polygon,
  text,
  svg,
} as const;

export type PrimitiveKind = keyof typeof PRIMITIVES_RUNTIME;

export type PrimitiveParamsByKind = {
  rect: RectParams;
  ellipse: EllipseParams;
  barStack: BarStackParams;
  wedge: WedgeParams;
  polygon: PolygonParams;
  text: TextParams;
  svg: SvgParams;
};

// Display order for the "+ Add primitive" menu. Curated for UX (the more
// distinct / generative shapes come first).
export const PRIMITIVE_KINDS: readonly PrimitiveKind[] = [
  "barStack",
  "wedge",
  "polygon",
  "rect",
  "ellipse",
  "text",
  "svg",
];

export function primitiveFor<K extends PrimitiveKind>(
  kind: K,
): PrimitiveModule<K, PrimitiveParamsByKind[K]> {
  return PRIMITIVES_RUNTIME[kind] as unknown as PrimitiveModule<K, PrimitiveParamsByKind[K]>;
}
