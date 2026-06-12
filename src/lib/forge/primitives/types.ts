// The shape every Primitive module presents to the rest of the forge.
//
// One Primitive = one kind of leaf shape (rect, ellipse, polygon, …).
// Each lives in its own folder under `src/lib/forge/primitives/<kind>/`
// with two files:
//
//   runtime.ts   — params type, defaults factory, label, randomize,
//                  geometry. The geometry returns the SVG markup for ONE
//                  base shape (no transform, no style attrs); export and
//                  boolean wrap it per instance.
//   controls.tsx — the React component that renders the params panel.
//
// See `docs/adr/0001-effect-module-registry.md`.

import type { ComponentType } from "react";

export type PrimitiveCenter = { x: number; y: number };

export type PrimitiveModule<K extends string, P> = {
  kind: K;
  label: string;
  /** Initial params for a freshly-added primitive, centered at `center`. */
  defaults(center: PrimitiveCenter): P;
  /** Reroll params within sensible visual bounds. Used by the
   *  "🎲 randomize" button. */
  randomize(current: P, center: PrimitiveCenter): P;
  /** Visual center — pivot for in-place rotation / scale by modifiers. */
  getCenter(p: P): PrimitiveCenter;
  /** SVG fragment for ONE base shape. No transform, no fill/stroke. The
   *  caller wraps it in a styled `<g transform>` per instance. */
  geometry(p: P): string;
  /** Optional override used by the boolean engine when geometry() emits
   *  markup paper.js can't path-import — text supplies path data via
   *  opentype here. When absent, boolean uses geometry(). */
  outlineGeometry?(p: P): string;
  /** Optional intrinsic seed transforms. Currently only barStack uses
   *  this: each entry becomes one instance with that transform. */
  seedTransforms?(p: P): Array<{ transform: string }>;
};

export type ControlsProps<P> = {
  params: P;
  onPatch: (patch: Record<string, unknown>) => void;
};

export type ControlsComponent<P> = ComponentType<ControlsProps<P>>;

const CENTER = 400;

/** Helper for randomize() implementations — same `jitter` shape they all want. */
export function randJitter(base: number, spread: number): number {
  return base + (Math.random() - 0.5) * spread;
}

/** Default center used by `defaults()` calls that don't get one from the caller. */
export const DEFAULT_CENTER: PrimitiveCenter = { x: CENTER, y: CENTER };
