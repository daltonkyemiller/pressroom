// Source of truth for forge modifier kinds. See ADR-0001.

import type { ModifierModule } from "./types";

import { linearRepeat, type LinearRepeatParams } from "./linearRepeat/runtime";
import { radialRepeat, type RadialRepeatParams } from "./radialRepeat/runtime";
import { gridRepeat, type GridRepeatParams } from "./gridRepeat/runtime";
import { mirror, type MirrorParams } from "./mirror/runtime";
import { scatter, type ScatterParams } from "./scatter/runtime";
import { colorCycle, type ColorCycleParams } from "./colorCycle/runtime";
import { clip, type ClipParams } from "./clip/runtime";
import { boolean, type BooleanParams } from "./boolean/runtime";

export const MODIFIERS_RUNTIME = {
  linearRepeat,
  radialRepeat,
  gridRepeat,
  mirror,
  scatter,
  colorCycle,
  clip,
  boolean,
} as const;

export type ModifierKind = keyof typeof MODIFIERS_RUNTIME;

export type ModifierParamsByKind = {
  linearRepeat: LinearRepeatParams;
  radialRepeat: RadialRepeatParams;
  gridRepeat: GridRepeatParams;
  mirror: MirrorParams;
  scatter: ScatterParams;
  colorCycle: ColorCycleParams;
  clip: ClipParams;
  boolean: BooleanParams;
};

// Display order for the "+ Add modifier" menu. Curated for UX (repeats
// grouped, color/clip/boolean as more transformative ones).
export const MODIFIER_KINDS: readonly ModifierKind[] = [
  "linearRepeat",
  "radialRepeat",
  "gridRepeat",
  "mirror",
  "scatter",
  "colorCycle",
  "clip",
  "boolean",
];

export function modifierFor<K extends ModifierKind>(
  kind: K,
): ModifierModule<K, ModifierParamsByKind[K]> {
  return MODIFIERS_RUNTIME[kind] as unknown as ModifierModule<K, ModifierParamsByKind[K]>;
}
