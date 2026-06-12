# 0002 — One Font registry shared between Pressroom and Forge

**Status:** Accepted
**Date:** 2026-06-11

## Context

Both `src/lib/dither/font-registry.ts` and `src/lib/forge/font-registry.ts` implement the same shape: a `Map<family, FontEntry>`, a `useSyncExternalStore` snapshot cache (with the same infinite-loop bug fixed in both), `queryLocalFonts()` plumbing, lazy byte fetching, family-level dedup. The export surfaces are almost identical.

What differs is the *terminal action* on the bytes:

- Pressroom (Text effect) ships bytes into the worker via `FontFace` so OffscreenCanvas renders correctly.
- Forge (text primitive + booleans) calls `opentype.parse(bytes)` so glyph outlines can be path-combined for boolean ops.

Same discovery, different representations.

## Decision

Discovery lives in one shared module: `src/lib/fonts/registry.ts`. It owns the `Map`, the subscribe / snapshot cache, the `queryLocalFonts()` call, the family dedup, and the lazy byte fetch.

Each tool plugs in a **representation loader** — a callback that receives `(family, bytes)` and stashes whatever the tool needs in the entry. Pressroom registers a loader that ships bytes to the worker. Forge registers a loader that parses outlines with `opentype.js`.

Permission carries across tools: once the user has granted local-fonts access on `/`, they don't have to re-grant on `/forge`.

## Consequences

**Wins**

- One copy of the discovery plumbing. We won't fix the same bug in two files again.
- Cross-tool permission carryover (free).
- Adding a third consumer (e.g. an export that embeds web fonts) is a third loader registration, not a third copy of the registry.

**Costs**

- A `src/lib/fonts/` shared zone now exists. Previously the two tools shared only `src/components/ui/` (shadcn primitives) and routing. This is the first shared *domain* module. We're saying out loud: when something is genuinely cross-tool, it lives here. Future cross-tool things should reach for this zone before duplicating.

## Alternatives considered

- **A factory each tool calls with its loader, producing its own registry instance.** Rejected: the user's permission grants and font list should be shared. Two registry instances mean two prompts, two enumerations, two snapshot caches.
- **Move discovery into one tool, the other imports from it.** Rejected: creates an arbitrary dependency direction. The shared zone is the honest answer.

## Not in scope

- The Text effect's worker font registration is still owned by pressroom — only the discovery side moves.
- Forge's `opentype.Font` representation stays in forge — only the discovery side moves.
