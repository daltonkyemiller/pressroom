// Public facade over the Effect registry.
//
// Each kind's params type, defaults, label, description, apply, summarize,
// and optional GPU adapter live in `effects/<kind>/runtime.ts`. The
// registry is `effects/runtime-registry.ts`. This file:
//
//   - re-exports the param types and the registry's derived `EffectKind`
//   - assembles the `Layer` discriminated union
//   - assembles the `EFFECT_DEFAULTS` / `EFFECT_LABELS` / `EFFECT_DESCRIPTIONS`
//     records (derived from the registry; here so callers can keep using
//     the old shape during the transition)
//   - exposes `applyLayer`, `summarizeLayer`, and `runStack` — all of
//     which now look the effect up in the registry rather than switching
//     on kind
//
// See `docs/adr/0001-effect-module-registry.md`.

import {
  EFFECTS_RUNTIME,
  EFFECT_KINDS,
  effectFor,
  gpuFor,
  type EffectKind,
  type ParamsByKind,
} from "./effects/runtime-registry";
import {
  isGpuAvailable,
  runGpuChain,
  type GpuChainItem,
} from "./gpu/runner";

export type { EffectKind, ParamsByKind } from "./effects/runtime-registry";
export { EFFECT_KINDS } from "./effects/runtime-registry";

export type { BlurParams } from "./effects/blur/runtime";
export type { ColorParams } from "./effects/color/runtime";
export type {
  HalftoneParams,
  HalftoneShape,
} from "./effects/halftone/runtime";
export type { DitherParams, DitherAlgo } from "./effects/dither/runtime";
export type { InvertParams } from "./effects/invert/runtime";
export type { NoiseParams } from "./effects/noise/runtime";
export type { DisplaceParams } from "./effects/displace/runtime";
export type { ChromaticParams } from "./effects/chromatic/runtime";
export type { EdgeBleedParams } from "./effects/edgeBleed/runtime";
export type { TextParams } from "./effects/text/runtime";
export type { StippleParams } from "./effects/stipple/runtime";
export type { RisoParams } from "./effects/riso/runtime";
// Already-extracted effects re-export through the registry's import paths.
export type { ProgressiveBlurParams } from "./progressive-blur";
export type { GrainParams } from "./grain";
export type { CurvesParams } from "./curves";
export type { DuotoneParams } from "./shader-duotone";

// Shared helpers (kept here as re-exports because the worker bundle's
// shader-duotone path imports `boxBlur` from this module).
export { boxBlur } from "./effects/utils";

export type Layer = {
  [K in EffectKind]: {
    id: number;
    kind: K;
    enabled: boolean;
    expanded: boolean;
    params: ParamsByKind[K];
  };
}[EffectKind];

// Object-literal shapes derived from the registry. Used by callers that
// still want the records (e.g. the "+ Add effect" menu in app.tsx and the
// preset roundtrip's default-merge). The registry remains the source of
// truth; these are thin views over it.
export const EFFECT_DEFAULTS = Object.fromEntries(
  EFFECT_KINDS.map((k) => [k, EFFECTS_RUNTIME[k].defaults]),
) as { [K in EffectKind]: ParamsByKind[K] };

export const EFFECT_LABELS = Object.fromEntries(
  EFFECT_KINDS.map((k) => [k, EFFECTS_RUNTIME[k].label]),
) as Record<EffectKind, string>;

export const EFFECT_DESCRIPTIONS = Object.fromEntries(
  EFFECT_KINDS.map((k) => [k, EFFECTS_RUNTIME[k].description]),
) as Record<EffectKind, string>;

export function applyLayer(img: ImageData, layer: Layer): ImageData {
  // Registry lookup replaces the 16-arm switch. The `as` is the standard
  // bridging cast for TS's correlated-union limitation (it can't
  // statically connect `layer.kind` to the matching params type across a
  // generic registry lookup).
  const fx = effectFor(layer.kind);
  return fx.apply(img, layer.params as never);
}

export function summarizeLayer(layer: Layer): string {
  const fx = effectFor(layer.kind);
  return fx.summarize(layer.params as never);
}

// Return a copy of `layers` with each layer's px-dimensioned params
// multiplied by `scale`. Used for the export path, which renders at the
// source resolution instead of the 900px preview — see ADR/comments on
// pipeline.ts:exportPNG. Effects without a `scaleParams` method are
// resolution-independent and pass through unchanged.
export function scaleLayers(layers: readonly Layer[], scale: number): Layer[] {
  if (scale === 1) return layers as Layer[];
  return layers.map((layer) => {
    const fx = effectFor(layer.kind);
    if (!fx.scaleParams) return layer;
    return {
      ...layer,
      params: fx.scaleParams(layer.params as never, scale) as never,
    } as Layer;
  });
}

// Adjacent GPU layers are batched into a single ping-pong run so the
// source is uploaded once and read back once. CPU layers interleave
// naturally — the batch flushes whenever a CPU layer is encountered.
export function runStack(img: ImageData, layers: readonly Layer[]): ImageData {
  const gpuOk = isGpuAvailable();
  let current = img;
  let batch: GpuChainItem[] = [];
  const flush = () => {
    if (batch.length === 0) return;
    current = runGpuChain(current, batch);
    batch = [];
  };
  for (const layer of layers) {
    if (!layer.enabled) continue;
    const gpu = gpuOk ? gpuFor(layer.kind) : undefined;
    if (gpu) {
      batch.push({ effect: gpu, params: layer.params });
    } else {
      flush();
      current = applyLayer(current, layer);
    }
  }
  flush();
  return current;
}
