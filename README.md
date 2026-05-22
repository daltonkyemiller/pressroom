# pressroom

A darkroom-style image effects editor. Stack effect layers (blur, color, halftone, dither, invert, noise), reorder them, toggle them on and off, and export the result as a PNG.

## Running

```sh
pnpm install
pnpm dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Effects

Layers run top-to-bottom on a working copy of the source image. Order matters — blur before dither softens grain; blur after destroys it.

- **Blur** — separable box blur (radius 0–20).
- **Color adjust** — contrast, brightness, midtones (gamma), saturation.
- **Halftone** — dot / line / cross / square pattern at arbitrary angle, with optional gooey alpha-blend pass and **preserve colors** toggle (samples the source color at each cell instead of using the palette ink).
- **Dither** — 8 algorithms: Floyd-Steinberg, Atkinson, Burkes, Sierra, Stucki, Bayer 4×4, Bayer 8×8, threshold. Serpentine scan toggle. **Preserve colors** dithers against a binary mask and lets the original color show through the light pixels.
- **Invert** — flip RGB values.
- **Noise** — uniform per-channel grain.

Six palettes ship by default: b&w, cream, gameboy, amber, cyan, redink.

## Canvas

- Wheel to zoom (0.25× – 16×), anchored to the cursor.
- Click-drag to pan when zoomed in.
- Double-click to reset.
- Drop an image anywhere in the window to load it.

## Performance

Each layer pass operates on a single `ImageData` buffer. While you're scrubbing a slider the pipeline renders at a lower resolution (`PREVIEW_MAX_DIM`) and snaps back to full working resolution (`MAX_DIM = 900`) on release. The canvas's CSS dimensions stay locked to the full-res working dims so the displayed size doesn't twitch during preview. Export renders at the source's native resolution.

## Stack

- Vite + React 19 (with React Compiler)
- Tailwind v4 + tw-animate-css
- shadcn `base-lyra` UI primitives on `@base-ui/react`
- [`nucleo-pixel`](https://www.npmjs.com/package/nucleo-pixel) for icons
- [`@atlaskit/pragmatic-drag-and-drop`](https://atlassian.design/components/pragmatic-drag-and-drop) for layer reordering
- Mondwest, Neue Bit, Geist Pixel display/body/mono fonts (in `public/font/`)

## Layout

```
src/
  app.tsx                       main shell — sidebar + stage + status bar
  lib/dither/                   the effects engine (pure functions)
    effects.ts                  per-effect appliers + Layer type
    kernels.ts                  error-diffusion + Bayer matrices
    palettes.ts                 palette colors + nearest-color lookup
    pipeline.ts                 renderPipeline / exportPNG
  components/
    dither/                     UI specific to the editor
      layer-card.tsx            single layer in the stack, draggable
      controls.tsx              SliderControl / SegControl / PaletteControl / ToggleControl
      number-scrubber.tsx       drag-to-set numeric input
      goo-filter.tsx            inline SVG goo filter (used by halftone)
    ui/                         shadcn primitives
public/font/                    woff2/otf font files
```
