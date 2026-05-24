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

import paper from "paper";
import { svgPlacementTransform } from "./engine";
import { getFontEntry } from "./font-registry";
import type { Node, Primitive, SvgParams, TextParams } from "./types";

export type BooleanOp = "union" | "subtract" | "intersect" | "exclude";

let initialized = false;
function ensurePaper() {
  if (initialized) return;
  paper.setup(new paper.Size(1, 1));
  initialized = true;
}

// Mirrors the SVG emitter in export.ts (kept private to avoid a circular dep
// once we import this from engine.ts). Only the shape geometry matters for
// boolean operations — style attrs are dropped.
function primitiveSvgFragment(p: Primitive): string {
  switch (p.kind) {
    case "rect": {
      const q = p.params;
      const rx = q.rx > 0 ? ` rx="${q.rx}"` : "";
      return `<rect x="${q.cx - q.w / 2}" y="${q.cy - q.h / 2}" width="${q.w}" height="${q.h}"${rx} />`;
    }
    case "ellipse": {
      const q = p.params;
      return `<ellipse cx="${q.cx}" cy="${q.cy}" rx="${q.rx}" ry="${q.ry}" />`;
    }
    case "barStack": {
      // Base rect for the bar shape; per-instance transforms (built in
      // engine.ts via barStackInstances) position and size each bar.
      const q = p.params;
      return `<rect x="${q.cx - q.width / 2}" y="${q.cy - q.height / 2}" width="${q.width}" height="${q.height}" />`;
    }
    case "wedge":
    case "polygon":
    case "text":
    case "svg":
      // Handled at the buildNodeSvg call site (wedge/polygon emit a path
      // d-string directly; text uses textPathSvg to convert glyphs to a
      // path via opentype.js; svg uses svgPrimitiveFragment to place the
      // parsed inner content).
      return "";
  }
}

function svgPrimitiveFragment(p: SvgParams): string {
  const placed = svgPlacementTransform(p);
  if (!placed) return "";
  return `<g transform="${placed.transform}">${placed.body}</g>`;
}

function textPathSvg(p: TextParams): string {
  const entry = getFontEntry(p.font);
  if (!entry?.font) return "";
  // opentype.js's getPath takes the baseline-left as the origin and the
  // size in pixels. SVG <text> with our anchor/baseline params positions
  // differently, so shift the origin to roughly match:
  //   - anchor "middle"/"end" → shift x by half/full advance width
  //   - baseline "hanging" → shift y down by ~size (top of cap)
  //   - baseline "middle" → shift y down by ~size * 0.35 (cap-half)
  //   - baseline "alphabetic" (default) → no shift
  let x = p.cx;
  let y = p.cy;
  const advance = entry.font.getAdvanceWidth(p.content, p.size);
  if (p.anchor === "middle") x -= advance / 2;
  else if (p.anchor === "end") x -= advance;
  if (p.baseline === "hanging") y += p.size;
  else if (p.baseline === "middle") y += p.size * 0.35;
  const d = entry.font.getPath(p.content, x, y, p.size).toPathData(3);
  if (!d) return "";
  if (p.rotation) {
    return `<g transform="rotate(${p.rotation} ${p.cx} ${p.cy})"><path d="${d}" /></g>`;
  }
  return `<path d="${d}" />`;
}

function buildNodeSvg(node: Node, instances: Array<{ transform: string }>): string {
  // Each instance becomes a <g transform="..."> wrapping a copy of the
  // primitive. paper.js sees one SVG document, parses transforms, and
  // gives us back paper.Items in matching world coordinates.
  //
  // We import the wedge/polygon shapes already in d-string form to avoid
  // round-tripping them through the export module (cycle).
  let shape: string;
  if (node.primitive.kind === "wedge") {
    shape = `<path d="${wedgeD(node.primitive.params)}" />`;
  } else if (node.primitive.kind === "polygon") {
    shape = `<path d="${polygonD(node.primitive.params)}" />`;
  } else if (node.primitive.kind === "text") {
    // Convert text to outline path via opentype.js (in textPathSvg).
    // Returns "" if the font's bytes haven't been parsed yet (e.g. local
    // font still lazy-loading), and the boolean degrades gracefully.
    shape = textPathSvg(node.primitive.params);
  } else if (node.primitive.kind === "svg") {
    shape = svgPrimitiveFragment(node.primitive.params);
  } else {
    shape = primitiveSvgFragment(node.primitive);
  }
  if (!shape) return "";

  const instanceTags = instances
    .map((inst) => {
      const t = inst.transform ? ` transform="${inst.transform.trim()}"` : "";
      return `<g${t}>${shape}</g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg">${instanceTags}</svg>`;
}

// Local copies of polygon/wedge d-string builders to keep this module
// independent of engine.ts (which already imports from here would otherwise
// create a cycle).
function polygonD(p: {
  cx: number;
  cy: number;
  radius: number;
  sides: number;
  starInner: number;
  rotation: number;
}): string {
  const sides = Math.max(3, Math.floor(p.sides));
  const isStar = p.starInner > 0 && p.starInner < 1;
  const totalPoints = isStar ? sides * 2 : sides;
  const innerR = isStar ? p.radius * p.starInner : p.radius;
  const startAngle = (p.rotation - 90) * (Math.PI / 180);
  let d = "";
  for (let i = 0; i < totalPoints; i++) {
    const angle = startAngle + (i / totalPoints) * Math.PI * 2;
    const r = isStar ? (i % 2 === 0 ? p.radius : innerR) : p.radius;
    const x = p.cx + Math.cos(angle) * r;
    const y = p.cy + Math.sin(angle) * r;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(3)},${y.toFixed(3)}`;
  }
  d += "Z";
  return d;
}

function wedgeD(p: {
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number;
  startAngle: number;
  sweep: number;
}): string {
  const startRad = (p.startAngle * Math.PI) / 180;
  const endRad = ((p.startAngle + p.sweep) * Math.PI) / 180;
  const ro = Math.max(0, p.outerRadius);
  const ri = Math.max(0, Math.min(ro, p.innerRadius));
  const absSweep = Math.abs(p.sweep);
  const largeArc = absSweep > 180 ? 1 : 0;
  const sweepFlag = p.sweep >= 0 ? 1 : 0;
  const ox1 = p.cx + Math.cos(startRad) * ro;
  const oy1 = p.cy + Math.sin(startRad) * ro;
  const ox2 = p.cx + Math.cos(endRad) * ro;
  const oy2 = p.cy + Math.sin(endRad) * ro;
  if (ri <= 0) {
    if (absSweep >= 360) {
      return `M${p.cx - ro},${p.cy} A${ro},${ro} 0 1,0 ${p.cx + ro},${p.cy} A${ro},${ro} 0 1,0 ${p.cx - ro},${p.cy} Z`;
    }
    return `M${p.cx.toFixed(3)},${p.cy.toFixed(3)} L${ox1.toFixed(3)},${oy1.toFixed(3)} A${ro},${ro} 0 ${largeArc},${sweepFlag} ${ox2.toFixed(3)},${oy2.toFixed(3)} Z`;
  }
  const ix1 = p.cx + Math.cos(startRad) * ri;
  const iy1 = p.cy + Math.sin(startRad) * ri;
  const ix2 = p.cx + Math.cos(endRad) * ri;
  const iy2 = p.cy + Math.sin(endRad) * ri;
  const innerSweepFlag = p.sweep >= 0 ? 0 : 1;
  if (absSweep >= 360) {
    return `M${p.cx - ro},${p.cy} A${ro},${ro} 0 1,0 ${p.cx + ro},${p.cy} A${ro},${ro} 0 1,0 ${p.cx - ro},${p.cy} Z M${p.cx - ri},${p.cy} A${ri},${ri} 0 1,1 ${p.cx + ri},${p.cy} A${ri},${ri} 0 1,1 ${p.cx - ri},${p.cy} Z`;
  }
  return `M${ix1.toFixed(3)},${iy1.toFixed(3)} L${ox1.toFixed(3)},${oy1.toFixed(3)} A${ro},${ro} 0 ${largeArc},${sweepFlag} ${ox2.toFixed(3)},${oy2.toFixed(3)} L${ix2.toFixed(3)},${iy2.toFixed(3)} A${ri},${ri} 0 ${largeArc},${innerSweepFlag} ${ix1.toFixed(3)},${iy1.toFixed(3)} Z`;
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

export function nodeToSvgFragment(
  node: Node,
  instances: Array<{ transform: string }>,
): string {
  return buildNodeSvg(node, instances);
}
