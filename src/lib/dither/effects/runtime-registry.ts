// The single source of truth for what effect kinds exist.
//
// Each effect lives in `effects/<kind>/runtime.ts` and exports an
// `EffectModule`. This file is the registry — a hand-maintained object
// literal mapping kind → module — and is imported by both the main
// thread and the worker.
//
// `EffectKind` is derived from `keyof typeof EFFECTS_RUNTIME` so the
// universe of kinds is the universe of registered modules. Adding a kind:
//
//   1. Create `effects/<newKind>/runtime.ts` exporting an
//      `EffectModule<"newKind", NewParams>`.
//   2. Add a line to EFFECTS_RUNTIME below.
//   3. Optionally add `effects/<newKind>/controls.tsx` and register it
//      in the controls registry (separate file; see ADR-0001).
//
// No React imports here — must remain worker-safe.

import type { EffectModule } from "./types";
import type { GpuEffect } from "../gpu/runner";

import { blur, type BlurParams } from "./blur/runtime";
import { progressiveBlur } from "./progressiveBlur/runtime";
import type { ProgressiveBlurParams } from "../progressive-blur";
import { color, type ColorParams } from "./color/runtime";
import { curves } from "./curves/runtime";
import type { CurvesParams } from "../curves";
import { halftone, type HalftoneParams } from "./halftone/runtime";
import { dither, type DitherParams } from "./dither/runtime";
import { invert, type InvertParams } from "./invert/runtime";
import { noise, type NoiseParams } from "./noise/runtime";
import { grain } from "./grain/runtime";
import type { GrainParams } from "../grain";
import { displace, type DisplaceParams } from "./displace/runtime";
import { chromatic, type ChromaticParams } from "./chromatic/runtime";
import { edgeBleed, type EdgeBleedParams } from "./edgeBleed/runtime";
import { text, type TextParams } from "./text/runtime";
import { stipple, type StippleParams } from "./stipple/runtime";
import { riso, type RisoParams } from "./riso/runtime";
import { duotone } from "./duotone/runtime";
import type { DuotoneParams } from "../shader-duotone";
import { dirt, type DirtParams } from "./dirt/runtime";

// One line per kind. TypeScript verifies each value's `kind` matches its key
// and each module has the right shape. The registry is the source of truth;
// `EffectKind` below is derived from it.
export const EFFECTS_RUNTIME = {
  blur,
  progressiveBlur,
  color,
  curves,
  halftone,
  dither,
  invert,
  noise,
  grain,
  displace,
  chromatic,
  edgeBleed,
  text,
  stipple,
  riso,
  duotone,
  dirt,
} as const;

export type EffectKind = keyof typeof EFFECTS_RUNTIME;

export type ParamsByKind = {
  blur: BlurParams;
  progressiveBlur: ProgressiveBlurParams;
  color: ColorParams;
  curves: CurvesParams;
  halftone: HalftoneParams;
  dither: DitherParams;
  invert: InvertParams;
  noise: NoiseParams;
  grain: GrainParams;
  displace: DisplaceParams;
  chromatic: ChromaticParams;
  edgeBleed: EdgeBleedParams;
  text: TextParams;
  stipple: StippleParams;
  riso: RisoParams;
  duotone: DuotoneParams;
  dirt: DirtParams;
};

// The display order used by the "+ Add effect" menu in app.tsx. Hand-
// curated for UX (related effects grouped, simple ones near the top), not
// implementation order. Update this when the picker should change.
export const EFFECT_KINDS: readonly EffectKind[] = [
  "blur",
  "progressiveBlur",
  "color",
  "curves",
  "halftone",
  "dither",
  "duotone",
  "displace",
  "chromatic",
  "edgeBleed",
  "stipple",
  "riso",
  "text",
  "invert",
  "noise",
  "grain",
  "dirt",
];

export function effectFor<K extends EffectKind>(
  kind: K,
): EffectModule<K, ParamsByKind[K]> {
  // The registry is typed as a heterogeneous record; this narrowing
  // covers the correlated-union limitation TS still can't express.
  return EFFECTS_RUNTIME[kind] as unknown as EffectModule<K, ParamsByKind[K]>;
}

export function gpuFor(kind: EffectKind): GpuEffect<unknown> | undefined {
  return EFFECTS_RUNTIME[kind].gpu as GpuEffect<unknown> | undefined;
}
