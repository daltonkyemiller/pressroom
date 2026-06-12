// Boolean operations on node geometry via paper.js.
//
// Paper.js gives us real path booleans (union/subtract/intersect/exclude)
// that work on the curves themselves, not just visual clipping. The result
// is a single merged path string ready to drop back into the SVG output.
//
// Each boolean op happens against a target sibling node. We feed paper.js
// an SVG fragment that contains all of the current node's accumulated
// instances and all of the target node's instances, let paper parse it
// into a tree, flatten that tree to a single PathItem per side, and then
// run the op. paper.js does the SVG transform parsing for us.
//
// Per-primitive geometry comes from the primitive registry — each
// primitive module exposes a `geometry()` method, and text additionally
// exposes `outlineGeometry()` since paper.js can't render <text> glyphs
// (it needs the opentype path).

import paper from "paper";
import { primitiveFor } from "./primitives/runtime-registry";
import type { Primitive } from "./types";

export type BooleanOp = "union" | "subtract" | "intersect" | "exclude";

let initialized = false;
function ensurePaper() {
  if (initialized) return;
  paper.setup(new paper.Size(1, 1));
  initialized = true;
}

// Boolean-safe representation of a primitive: use its outline geometry when
// the module supplies one (text → opentype path data), otherwise fall back
// to the render-time geometry.
function primitiveToSvg(p: Primitive): string {
  const m = primitiveFor(p.kind);
  const outline = m.outlineGeometry?.(p.params as never);
  if (outline) return outline;
  return m.geometry(p.params as never);
}

// Build an SVG document from a flat list of instances. Used by the
// boolean engine to hand paper.js a complete piece of geometry. Each
// instance can reference a DIFFERENT primitive (groups produce that), so
// we generate the shape fragment per-instance instead of once.
function buildInstancesSvg(
  instances: Array<{ primitive?: Primitive; transform: string; pathOverride?: string }>,
): string {
  const tags = instances
    .map((inst) => {
      const t = inst.transform ? ` transform="${inst.transform.trim()}"` : "";
      const shape = inst.pathOverride
        ? `<path d="${inst.pathOverride}" />`
        : inst.primitive
          ? primitiveToSvg(inst.primitive)
          : "";
      return shape ? `<g${t}>${shape}</g>` : "";
    })
    .filter(Boolean)
    .join("");
  return tags ? `<svg xmlns="http://www.w3.org/2000/svg">${tags}</svg>` : "";
}

// Walks a paper.Item tree and unions every Path/CompoundPath into one.
// Strokes/fills don't matter for boolean ops — we just need geometry.
function flattenToPath(item: paper.Item): paper.PathItem | null {
  const paths: paper.PathItem[] = [];
  function walk(i: paper.Item) {
    if (i instanceof paper.Path || i instanceof paper.CompoundPath) {
      paths.push(i as paper.PathItem);
    } else if (i.children) {
      for (const c of [...i.children]) walk(c);
    }
  }
  walk(item);
  if (paths.length === 0) {
    item.remove();
    return null;
  }
  let merged: paper.PathItem = paths[0].clone({ insert: true }) as paper.PathItem;
  for (let i = 1; i < paths.length; i++) {
    const next = merged.unite(paths[i]) as paper.PathItem;
    merged.remove();
    merged = next;
  }
  item.remove();
  return merged;
}

function importAndFlatten(svg: string): paper.PathItem | null {
  if (!svg) return null;
  try {
    // expandShapes: convert <rect>, <ellipse>, <circle> etc. into Path
    // instances. Without this paper produces paper.Shape items, which
    // flattenToPath would skip — and the boolean would silently no-op.
    const item = paper.project.importSVG(svg, {
      insert: true,
      expandShapes: true,
    });
    return flattenToPath(item);
  } catch (err) {
    console.error("forge boolean: importSVG failed", err);
    return null;
  }
}

export function computeBooleanPath(
  selfSvg: string,
  targetSvg: string,
  op: BooleanOp,
): string {
  ensurePaper();
  const a = importAndFlatten(selfSvg);
  const b = importAndFlatten(targetSvg);
  if (!a) {
    if (b) b.remove();
    return "";
  }
  if (!b) {
    const d = a.pathData;
    a.remove();
    return d;
  }
  let result: paper.PathItem | null = null;
  if (op === "union") result = a.unite(b) as paper.PathItem;
  else if (op === "subtract") result = a.subtract(b) as paper.PathItem;
  else if (op === "intersect") result = a.intersect(b) as paper.PathItem;
  else if (op === "exclude") result = a.exclude(b) as paper.PathItem;
  a.remove();
  b.remove();
  if (!result) return "";
  const d = result.pathData;
  result.remove();
  return d;
}

export function instancesToSvgFragment(
  instances: Array<{ primitive?: Primitive; transform: string; pathOverride?: string }>,
): string {
  return buildInstancesSvg(instances);
}
