// The shape every Modifier module presents to the rest of the forge.
//
// One Modifier = one kind of instance-list transformer (linearRepeat,
// mirror, boolean, …). Each lives in its own folder under
// `src/lib/forge/modifiers/<kind>/` with two files:
//
//   runtime.ts   — params type, defaults factory, label, apply().
//                  `apply()` receives the instance list and a context bag
//                  with the helpers it needs (compose, hash, expandNode,
//                  clipDefs to push into).
//   controls.tsx — the React component that renders the params panel.
//
// See `docs/adr/0001-effect-module-registry.md`.

import type { ComponentType } from "react";
import type { ClipDef, Expanded, Instance } from "../engine";
import type { Node as ForgeNode } from "../types";

export type ModifierCenter = { x: number; y: number };

/** The context passed to every modifier's `apply`. Everything a modifier
 *  needs from the engine to do its job — keeps the modules independent of
 *  the engine's internals so they can be tested in isolation. */
export type ModifierContext = {
  node: ForgeNode;
  allNodes: readonly ForgeNode[];
  /** Pivot used by per-instance rotation / scale. For a primitive node
   *  it's the primitive's visual center; for a group it's the children's
   *  pivot centroid. */
  pivot: ModifierCenter;
  /** Compose a new modifier transform onto the existing instance
   *  transform. The new transform goes outermost — see engine.ts for
   *  why this matters with barStack-style seeded transforms. */
  composeTransform(existing: string, next: string): string;
  /** Deterministic [0, 1) hash. */
  hash(seed: number, i: number): number;
  /** Signed deterministic [-1, 1] hash. */
  hashSigned(seed: number, i: number): number;
  /** Recursive expansion used by the boolean modifier when it materializes
   *  the target node's geometry. */
  expandNode(node: ForgeNode, all: readonly ForgeNode[]): Expanded;
  /** Mutable list the engine collects defs into. The clip modifier pushes
   *  a new entry; everyone else leaves it alone. */
  clipDefs: ClipDef[];
};

export type ModifierModule<K extends string, P> = {
  /** Discriminator value. Used as the registry key and the Modifier.kind tag. */
  kind: K;
  /** Sidebar label. */
  label: string;
  /** Initial params for a freshly-added modifier, optionally centered at a
   *  point (radialRepeat / mirror / clip use the doc center as default). */
  defaults(center: ModifierCenter): P;
  /** Transform a list of instances into the modifier's output. */
  apply(instances: Instance[], params: P, ctx: ModifierContext): Instance[];
};

export type ControlsProps<P> = {
  params: P;
  palette: string[];
  nodes: ForgeNode[];
  currentNodeId: number;
  onPatch: (patch: Record<string, unknown>) => void;
};

export type ControlsComponent<P> = ComponentType<ControlsProps<P>>;
