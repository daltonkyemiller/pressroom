// Main-thread companion to runtime-registry.ts. Maps each kind to its
// React controls component. Lives in a separate file so the worker bundle
// never pulls these (and React) in.

import type { ComponentType } from "react";
import type { ControlsProps } from "./types";
import type { EffectKind, ParamsByKind } from "./runtime-registry";

import { BlurControls } from "./blur/controls";
import { ProgressiveBlurControls } from "./progressiveBlur/controls";
import { ColorControls } from "./color/controls";
import { CurvesControls } from "./curves/controls";
import { HalftoneControls } from "./halftone/controls";
import { DitherControls } from "./dither/controls";
import { InvertControls } from "./invert/controls";
import { NoiseControls } from "./noise/controls";
import { GrainControls } from "./grain/controls";
import { DisplaceControls } from "./displace/controls";
import { ChromaticControls } from "./chromatic/controls";
import { EdgeBleedControls } from "./edgeBleed/controls";
import { TextControls } from "./text/controls";
import { StippleControls } from "./stipple/controls";
import { RisoControls } from "./riso/controls";
import { DuotoneControls } from "./duotone/controls";

export const EFFECTS_CONTROLS = {
  blur: BlurControls,
  progressiveBlur: ProgressiveBlurControls,
  color: ColorControls,
  curves: CurvesControls,
  halftone: HalftoneControls,
  dither: DitherControls,
  invert: InvertControls,
  noise: NoiseControls,
  grain: GrainControls,
  displace: DisplaceControls,
  chromatic: ChromaticControls,
  edgeBleed: EdgeBleedControls,
  text: TextControls,
  stipple: StippleControls,
  riso: RisoControls,
  duotone: DuotoneControls,
} as const;

export function controlsFor<K extends EffectKind>(
  kind: K,
): ComponentType<ControlsProps<ParamsByKind[K]>> {
  return EFFECTS_CONTROLS[kind] as ComponentType<ControlsProps<ParamsByKind[K]>>;
}
