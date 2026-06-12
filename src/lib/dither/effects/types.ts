// The shape every Effect module presents to the rest of the app.
//
// One Effect = one kind of image transformation. Each lives in its own
// folder under `src/lib/dither/effects/<kind>/` with two files:
//
//   runtime.ts   — params type, defaults, label, description, apply,
//                  summarize, optional GPU adapter. Worker-safe (no React).
//   controls.tsx — the React component that renders the params panel for
//                  the Layer card on the main thread.
//
// The two registry modules — `runtime-registry.ts` and `controls-registry.tsx`
// — wire each effect's runtime/controls into a typed lookup by kind. See
// `docs/adr/0001-effect-module-registry.md` for the why.

import type { ComponentType } from "react";
import type { GpuEffect } from "../gpu/runner";

export type EffectModule<K extends string, P> = {
  /** Discriminator value. Used as the registry key and the Layer.kind tag. */
  kind: K;
  /** Sidebar label, also reused as the drag-preview pill text. */
  label: string;
  /** One-line subtitle in the "+ Add effect" menu. */
  description: string;
  /** Initial params when the effect is freshly added to a stack. */
  defaults: P;
  /** Apply this effect to an ImageData in-place (or return a new one). */
  apply: (img: ImageData, params: P) => ImageData;
  /** Short status line under the effect's name in the layer card. */
  summarize: (params: P) => string;
  /** Optional WebGL adapter. When present, runStack batches adjacent
   *  GPU-adaptered layers into a single ping-pong run. */
  gpu?: GpuEffect<P>;
  /** Scale px-dimensioned params for a different render resolution.
   *  Preview renders at MAX_DIM=900; export renders at source res with
   *  `scale = sourceWidth / previewWidth`. Effects with no px-dimensioned
   *  params can omit this — the pipeline defaults to identity.
   *
   *  This is the WYSIWYG mechanism: a halftone with `size=8` at the 900px
   *  preview occupies the same fraction of the canvas as `size=8*scale`
   *  at source res, so the export reads as the same composition with
   *  more fidelity (and without the upscale grid artifact). */
  scaleParams?: (params: P, scale: number) => P;
};

/** Props every controls component receives from the layer card. */
export type ControlsProps<P> = {
  params: P;
  onPatch: (patch: Record<string, unknown>) => void;
  onStart: () => void;
  onCommit: () => void;
};

export type ControlsComponent<P> = ComponentType<ControlsProps<P>>;
