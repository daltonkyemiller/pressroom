// Pixelate modifier.
//
// Replaces a node's instances with a grid of solid-colored rects sampled
// from a raster of the node's current geometry. Use case: "upload an
// SVG, pixelate it, export new SVG" — the output stays pure vectors,
// just rect-heavy.
//
// **Async dance.** Modifier `apply` is synchronous (it has to be — the
// rest of the engine + the React render path don't await). But the only
// way to get pixel values out of an SVG fragment is to load it into an
// Image, draw to a Canvas, and readPixels — all async. So:
//
//   1. apply() builds a cache key from the node's current SVG fragment
//      + cellSize + docSize.
//   2. Cache hit → return the rect-instances synchronously.
//   3. Cache miss → kick off the rasterization, return the instances
//      *unchanged* (the user sees the original geometry for one frame),
//      and notify subscribers when the cache fills. The forge app
//      subscribes via `subscribePixelate` and bumps a render-trigger
//      state, so the next render hits the cache.
//
// LRU-capped to keep memory bounded if the user scrubs cellSize.

import type { Instance } from "../../engine";
import { instancesToSvgFragment } from "../../boolean";
import type { ModifierModule } from "../types";

export type PixelateParams = {
  /** Output cell size in px. Smaller = more rects, slower, bigger SVG. */
  cellSize: number;
  /** 0..255. Cells with average alpha below this get dropped (no rect
   *  emitted), so transparent regions in the source stay transparent. */
  alphaThreshold: number;
  /** 0..1. Cells with luminance below this get tinted toward black or
   *  dropped if you want; for now it's a simple opacity multiplier on
   *  the output rect. Defaulted off (1). */
  opacityScale: number;
};

type GridCell = {
  x: number;
  y: number;
  w: number;
  h: number;
  // RGB ints 0..255, alpha 0..1.
  r: number;
  g: number;
  b: number;
  a: number;
};

const CACHE_LIMIT = 16;
// Map preserves insertion order; deleting + re-setting bumps to end →
// poor-man's LRU.
const cache = new Map<string, GridCell[]>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();

// Most recent successful rasterization, kept around even when the LRU
// evicts its entry. Serves as a "while you wait" fallback so a cache
// miss during scrubbing doesn't flash the original un-pixelated SVG.
// The user sees stale pixelation (probably wrong cellSize) for the
// 50-200ms it takes the new raster to complete — much smoother than
// the un-effected source jumping back into frame.
let lastSuccessful: GridCell[] | null = null;

/** Subscribe to "the pixelate cache has new data" notifications. Forge
 *  app uses this to bump a render-trigger state so the next render's
 *  apply call gets the cached result. */
export function subscribePixelate(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify() {
  for (const l of listeners) l();
}

function touchLru(key: string, cells: GridCell[]) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, cells);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function rasterizeAndSample(
  svgFragment: string,
  docW: number,
  docH: number,
  cellSize: number,
): Promise<GridCell[]> {
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${docW} ${docH}" width="${docW}" height="${docH}">${svgFragment}</svg>`;
  const blob = new Blob([fullSvg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("pixelate: svg failed to rasterize"));
      im.src = url;
    });
    const gridW = Math.max(1, Math.ceil(docW / cellSize));
    const gridH = Math.max(1, Math.ceil(docH / cellSize));
    // Draw at grid resolution — the browser does the averaging for us.
    const canvas = document.createElement("canvas");
    canvas.width = gridW;
    canvas.height = gridH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, gridW, gridH);
    const data = ctx.getImageData(0, 0, gridW, gridH).data;
    const cells: GridCell[] = [];
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const i = (gy * gridW + gx) * 4;
        const a = data[i + 3];
        cells.push({
          x: gx * cellSize,
          y: gy * cellSize,
          w: cellSize,
          h: cellSize,
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
          a: a / 255,
        });
      }
    }
    return cells;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cellsToInstances(
  cells: GridCell[],
  params: PixelateParams,
  fallback: Instance | undefined,
): Instance[] {
  const alphaCutoff = params.alphaThreshold / 255;
  const opacityMul = Math.max(0, Math.min(1, params.opacityScale));

  // Coalesce cells by (color, quantized-opacity) into compound paths.
  // Without this, cellSize=4 on an 800×800 doc emits 40k <rect>
  // elements and React reconciliation takes seconds — the slow render
  // is the actual symptom when "typing a cellSize doesn't update."
  // Same raster typically has under a few hundred unique colors, so
  // the DOM goes from O(cells) to O(unique colors), a 100-1000x cut.
  // pathOverride is already a first-class field on Instance (the
  // boolean modifier emits it the same way), so renderer + export
  // pick it up with no changes.
  type Group = { fill: string; opacity: number; pieces: string[] };
  const groups = new Map<string, Group>();
  for (const c of cells) {
    if (c.a <= alphaCutoff) continue;
    const r = c.r | 0;
    const g = c.g | 0;
    const b = c.b | 0;
    const opacity = c.a * opacityMul;
    // Quantize opacity to 2 decimal places so near-duplicates merge.
    // Without this, alpha noise across cells would explode the group
    // count and partly defeat the optimization.
    const oQ = Math.round(opacity * 100) / 100;
    const key = `${r}_${g}_${b}_${oQ}`;
    let group = groups.get(key);
    if (!group) {
      group = { fill: `rgb(${r},${g},${b})`, opacity: oQ, pieces: [] };
      groups.set(key, group);
    }
    // Subpath = move to top-left, h(w), v(h), h(-w), close. SVG path
    // d-strings happily concatenate any number of these.
    group.pieces.push(`M${c.x},${c.y}h${c.w}v${c.h}h${-c.w}z`);
  }

  const out: Instance[] = [];
  for (const grp of groups.values()) {
    out.push({
      primitive: {
        kind: "rect",
        // pathOverride wins so these stub params never render — they
        // satisfy the Instance type.
        params: { cx: 0, cy: 0, w: 0, h: 0, rx: 0 },
      },
      transform: "",
      fill: grp.fill,
      stroke: fallback?.stroke ?? "none",
      strokeWidth: 0,
      opacity: grp.opacity,
      pathOverride: grp.pieces.join(""),
    });
  }
  return out;
}

export const pixelate: ModifierModule<"pixelate", PixelateParams> = {
  kind: "pixelate",
  label: "Pixelate",
  defaults: () => ({ cellSize: 16, alphaThreshold: 16, opacityScale: 1 }),
  apply(instances, params, ctx) {
    const cellSize = Math.max(2, Math.round(params.cellSize));
    if (instances.length === 0) return instances;
    const fragment = instancesToSvgFragment(instances);
    const docW = ctx.docSize.width;
    const docH = ctx.docSize.height;
    // The fragment captures everything upstream of this modifier; docSize
    // pins the rasterization canvas; cellSize is the only other variable.
    // alphaThreshold/opacityScale don't go in the key — they apply to
    // already-sampled cells at emit time, so changing them doesn't
    // require re-rasterizing.
    const key = `${docW}x${docH}|${cellSize}|${fragment}`;
    const cached = cache.get(key);
    if (cached) {
      // Bump to MRU position.
      touchLru(key, cached);
      lastSuccessful = cached;
      return cellsToInstances(cached, params, instances[0]);
    }
    if (!inflight.has(key)) {
      inflight.add(key);
      rasterizeAndSample(fragment, docW, docH, cellSize)
        .then((cells) => {
          touchLru(key, cells);
          lastSuccessful = cells;
          inflight.delete(key);
          notify();
        })
        .catch((err) => {
          console.warn("pixelate: rasterization failed", err);
          inflight.delete(key);
        });
    }
    // Show the last successful raster while the new one cooks. Before
    // this fallback, scrubbing cellSize / upstream geometry would flash
    // the un-pixelated SVG on every cache miss — including the moment
    // of release, where the raster for the just-committed value is
    // still in flight. Stale pixelation reads as "loading" instead of
    // "broken." On the first apply ever (no successful raster yet) we
    // still return original — there's no alternative.
    if (lastSuccessful) {
      return cellsToInstances(lastSuccessful, params, instances[0]);
    }
    return instances;
  },
};
