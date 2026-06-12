# 0001 — Effects, Primitives, and Modifiers are module registries

**Status:** Accepted
**Date:** 2026-06-11

## Context

Both tools grew their kind-sets the same way: each `kind` is just an arm in a big switch. Pressroom hit 16 effects; Forge hit 7 primitives and 8 modifiers. Adding one effect or primitive touched 5–8 files in lockstep (params type, defaults, label, description, apply, summarize, controls panel, sometimes `EFFECT_KINDS` arrays, sometimes GPU registry). The compiler caught type-sync errors but never intent-sync ones (forgetting `EFFECT_KINDS` makes the effect silently absent from the picker).

The friction is "the Effect / Primitive / Modifier doesn't exist as a *module* — only its `kind` does."

## Decision

Each kind is one module. The module owns everything a caller needs to know about it. Callers look the module up by kind via a registry; they never see the universe of kinds.

For each axis (pressroom Effects, forge Primitives, forge Modifiers):

- One folder per kind under `src/lib/<tool>/<axis>/<kind>/` containing two files:
  - `runtime.ts` — params type, defaults, label, description, apply / expand / summarize. Worker-safe (no React imports). For pressroom Effects, the optional GPU adapter lives here too.
  - `controls.tsx` — the React component that renders the params panel.
- One **runtime registry** module per axis: a typed object literal mapping kind → runtime module. Worker imports this.
- One **controls registry** module per axis: a typed object literal mapping kind → controls component. Main thread imports this.
- `Kind` types are derived: `EffectKind = keyof typeof EFFECTS_RUNTIME`. The registry is the source of truth.

The runtime registry is hand-maintained (not glob-imported) so that:
- TypeScript can verify every kind has a module with the right shape.
- Tree-shaking works: the worker bundle pulls in only `runtime.ts` files, never React.
- Adding a kind requires editing one well-known file (the registry), so the failure mode of "I added the module but forgot to register it" is local and obvious — `runtime-registry.ts`'s line count is the count of kinds.

## Consequences

**Wins**

- Adding a new effect / primitive / modifier = creating one folder + two registry entries. Today: 5–8 file edits.
- The per-kind switches in `applyLayer`, `summarizeLayer`, `applyModifier`, `getPrimitiveCenter`, `boolean.ts`'s `primitiveSvgFragment`, the controls files, and the `*_KINDS` arrays all collapse to registry lookups.
- The `layer-card.tsx` (1538 lines) and `forge/controls.tsx` (950 lines) files shrink dramatically.
- The pressroom GPU registry (`GPU_EFFECTS`) is absorbed into the Effect module — GPU becomes a property of an effect, not a parallel surface.

**Costs**

- More files (one folder per kind × 2 axes for forge × the equivalent split for pressroom).
- Two hand-maintained registries per axis instead of one big union (runtime vs. controls). Mitigated: both registries are simple object literals, TypeScript verifies completeness, and the failure mode is loud (TS error).
- A small bridging cast inside `applyLayer` to satisfy TS's correlated-union limitation. Standard pattern.

## Alternatives considered

- **Single registry mixing runtime + controls.** Rejected: bloats the worker bundle with React. Tree-shaking cannot reliably remove individual object properties from a registry literal.
- **`import.meta.glob` for auto-registration.** Rejected: loses TypeScript type safety on the registry shape and on the `Kind` union derivation. The whole point of the registry is that it's a typed lookup.
- **Keep one giant file per axis.** Rejected: this is what we have. The friction is what motivated the ADR.

## Not in scope

- The Pipeline (worker plumbing) keeps its current shape. It just calls `runStack`, which now consults the Effect registry instead of switching on kind.
- The doc tree and Node type stay as-is. Groups remain a special kind; ADR-0003 covers whether Group should become "another primitive" (decision: no).
