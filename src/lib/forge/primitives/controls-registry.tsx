import type { ComponentType } from "react";
import type { ControlsProps } from "./types";
import type { PrimitiveKind, PrimitiveParamsByKind } from "./runtime-registry";

import { RectControls } from "./rect/controls";
import { EllipseControls } from "./ellipse/controls";
import { BarStackControls } from "./barStack/controls";
import { WedgeControls } from "./wedge/controls";
import { PolygonControls } from "./polygon/controls";
import { TextControls } from "./text/controls";
import { SvgControls } from "./svg/controls";

export const PRIMITIVES_CONTROLS = {
  rect: RectControls,
  ellipse: EllipseControls,
  barStack: BarStackControls,
  wedge: WedgeControls,
  polygon: PolygonControls,
  text: TextControls,
  svg: SvgControls,
} as const;

export function primitiveControlsFor<K extends PrimitiveKind>(
  kind: K,
): ComponentType<ControlsProps<PrimitiveParamsByKind[K]>> {
  return PRIMITIVES_CONTROLS[kind] as ComponentType<ControlsProps<PrimitiveParamsByKind[K]>>;
}
