import type { ComponentType } from "react";
import type { ControlsProps } from "./types";
import type { ModifierKind, ModifierParamsByKind } from "./runtime-registry";

import { LinearRepeatControls } from "./linearRepeat/controls";
import { RadialRepeatControls } from "./radialRepeat/controls";
import { GridRepeatControls } from "./gridRepeat/controls";
import { MirrorControls } from "./mirror/controls";
import { ScatterControls } from "./scatter/controls";
import { ColorCycleControls } from "./colorCycle/controls";
import { ClipControls } from "./clip/controls";
import { BooleanControls } from "./boolean/controls";
import { PixelateControls } from "./pixelate/controls";

export const MODIFIERS_CONTROLS = {
  linearRepeat: LinearRepeatControls,
  radialRepeat: RadialRepeatControls,
  gridRepeat: GridRepeatControls,
  mirror: MirrorControls,
  scatter: ScatterControls,
  colorCycle: ColorCycleControls,
  clip: ClipControls,
  boolean: BooleanControls,
  pixelate: PixelateControls,
} as const;

export function modifierControlsFor<K extends ModifierKind>(
  kind: K,
): ComponentType<ControlsProps<ModifierParamsByKind[K]>> {
  return MODIFIERS_CONTROLS[kind] as ComponentType<ControlsProps<ModifierParamsByKind[K]>>;
}
