# Pressroom — domain vocabulary

Anchor for architecture conversations. When in doubt, use these terms with these meanings. If a refactor introduces a concept that doesn't fit, sharpen one of these or add a new entry here before writing code.

This repo hosts **two tools** that share a router and a deploy but otherwise live in separate libraries.

## Pressroom (the image-effect tool, mounted at `/`)

**Layer** — one entry in the user's effect stack. Carries an `id`, an `enabled` / `expanded` flag, a `kind` discriminator, and the params for that kind. A layer is a value, not a function — it's what gets persisted, copied to the clipboard, and saved in a preset.

**Effect** — a kind of image transformation (`blur`, `halftone`, `dither`, `text`, …). An effect is a *module*: it owns its params type, defaults, label, description, the function that applies it to an `ImageData`, the function that summarizes a layer of its kind for the layer card, the React component that renders its controls panel, and optionally a GPU adapter for the WebGL fast path.

A Layer's `kind` is the key into the Effect registry. The registry IS the source of truth — `EffectKind = keyof typeof EFFECTS`.

**Stack** — the ordered list of Layers on the doc. Has no separate type; just `readonly Layer[]`. Stacks roundtrip via the **preset** module: localStorage and the clipboard both carry the same id-less, versioned envelope of Layer values.

**Pipeline** — the worker-backed apply machinery. Takes a source image + a Stack, returns an `ImageData`. Has a synchronous flavor (`renderPipeline`, used by export) and an async worker-backed flavor (`renderPipelineAsync`, used by the live preview). The worker side calls `runStack`, which iterates Layers and looks each Effect up in the registry.

**GPU adapter** — the optional WebGL implementation attached to an Effect. The Pipeline batches adjacent GPU-adaptered effects into a single ping-pong run so the source is uploaded once and read back once. Effects without a GPU adapter run on CPU.

**Font registry** — the registry of typefaces available to the Text effect. Owns both built-in fonts (shipped with the app) and local fonts (pulled in via `window.queryLocalFonts()`). The Text effect's apply ships the chosen font's bytes into the worker so OffscreenCanvas can render with them.

## Forge (the generative-SVG tool, mounted at `/forge`)

**Doc** — the user's working document. Width / height / background / palette / grain plus a tree of Nodes.

**Node** — a position in the doc tree. Either a **Primitive node** (one shape) or a **Group node** (a list of child nodes that get treated as one geometry by modifiers on the group). Node kind discriminator is `kind: "primitive" | "group"`.

**Primitive** — a kind of leaf shape (`rect`, `ellipse`, `barStack`, `wedge`, `polygon`, `text`, `svg`). A primitive is a *module*: it owns its params type, default factory, visual center, the SVG fragment it produces (the same fragment serves live render, export, and boolean operands), the React controls component, and a randomize range.

**Modifier** — a kind of instance-list transformer (`linearRepeat`, `radialRepeat`, `gridRepeat`, `mirror`, `scatter`, `colorCycle`, `clip`, `boolean`). A modifier is a *module*: it owns its params type, default factory, apply-to-instances function, and React controls component.

**Instance** — an entry in the flat list a Node expands to. Carries a primitive reference, a composed SVG transform string, resolved style, and optional clip path / path override. Modifiers consume and produce Instance lists.

**Expansion** — `expandNode(node, allNodes) → { instances, clipDefs }`. Each Node has a seed (one identity instance for most primitives; N per-bar instances for `barStack`; recursive concat-of-children for groups). Each enabled modifier transforms the instance list in order. The result is what the renderer iterates.

**Prefab** — a named recipe that builds a fully-wired Node when added (e.g. "Totem cross" = bar stack + radial repeat). Lives in the prefab registry alongside the doc's `+ prefab` menu.

## Shared

**Font** — a typeface, identified by CSS font-family. Both tools have a font registry (today these are separate modules with near-identical surfaces; ADR-0002 covers consolidation).

**Effect / Primitive / Modifier registries** — hand-maintained tables that map kind → module. Adding a new kind = creating the module + one entry in the registry. The registry is the single source of truth for what kinds exist; the `Kind` union is derived from it via `keyof typeof REGISTRY`.

## Don't use these words

- "Service," "Handler," "Manager," "Engine" — vague and overloaded; use the module name above (Effect, Primitive, Pipeline, Expansion).
- "Component" — reserved for React UI components specifically. The whole "Effect" thing is a *module*, not a component.
- "Plugin," "Extension" — we don't have runtime-loaded code. Effects/Primitives/Modifiers are statically registered modules.
- "Boundary" — say **seam** or **interface** (per `LANGUAGE.md`).
