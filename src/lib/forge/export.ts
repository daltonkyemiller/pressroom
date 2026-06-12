// SVG + PNG export. SVG is built as a string (faster + no SSR dep than
// react-dom/server). PNG rasterizes the SVG via a Blob URL onto a canvas.

import { expandNode, getBooleanHiddenIds, type ClipDef } from "./engine";
import { primitiveFor } from "./primitives/runtime-registry";
import type { Doc, Node, Primitive } from "./types";

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function primitiveSvg(primitive: Primitive): string {
  // Each primitive module owns the SVG fragment for ONE base shape (no
  // style attrs, no transform). The caller wraps it per instance below.
  return primitiveFor(primitive.kind).geometry(primitive.params as never);
}

function clipDefSvg(def: ClipDef): string {
  if (def.invert) {
    const inner =
      def.shape === "ellipse"
        ? `M0,0 H100000 V100000 H0 Z M${def.cx - def.w / 2},${def.cy} a${def.w / 2},${def.h / 2} 0 1,0 ${def.w},0 a${def.w / 2},${def.h / 2} 0 1,0 ${-def.w},0 Z`
        : `M0,0 H100000 V100000 H0 Z M${def.cx - def.w / 2},${def.cy - def.h / 2} h${def.w} v${def.h} h${-def.w} Z`;
    return `<clipPath id="${def.id}" clipPathUnits="userSpaceOnUse"><path d="${inner}" fill-rule="evenodd" /></clipPath>`;
  }
  const shape =
    def.shape === "ellipse"
      ? `<ellipse cx="${def.cx}" cy="${def.cy}" rx="${def.w / 2}" ry="${def.h / 2}" />`
      : `<rect x="${def.cx - def.w / 2}" y="${def.cy - def.h / 2}" width="${def.w}" height="${def.h}" />`;
  return `<clipPath id="${def.id}" clipPathUnits="userSpaceOnUse">${shape}</clipPath>`;
}

function nodeSvg(node: Node, allNodes: readonly Node[]): string {
  const { instances, clipDefs } = expandNode(node, allNodes);
  const defs = clipDefs.length > 0 ? `<defs>${clipDefs.map(clipDefSvg).join("")}</defs>` : "";
  // Style is now resolved per-instance (groups can mix primitives and
  // styles), so we set fill/stroke/opacity on each instance's <g>.
  const body = instances
    .map((inst) => {
      const t = inst.transform ? ` transform="${escapeAttr(inst.transform.trim())}"` : "";
      const cp = inst.clipPathId ? ` clip-path="url(#${inst.clipPathId})"` : "";
      const fill = ` fill="${escapeAttr(inst.fill)}"`;
      const stroke = ` stroke="${escapeAttr(inst.stroke)}"`;
      const sw = inst.strokeWidth ? ` stroke-width="${inst.strokeWidth}"` : "";
      const op = ` opacity="${inst.opacity}"`;
      const shape = inst.pathOverride
        ? `<path d="${inst.pathOverride}" />`
        : primitiveSvg(inst.primitive);
      return `<g${t}${cp}${fill}${stroke}${sw}${op}>${shape}</g>`;
    })
    .join("");
  return `${defs}<g>${body}</g>`;
}

function grainSvg(doc: Doc): string {
  if (!doc.grain.enabled || doc.grain.amount <= 0) return "";
  const mono = doc.grain.monochrome
    ? `<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0" />`
    : "";
  return `<defs><filter id="forge-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${doc.grain.frequency}" numOctaves="${doc.grain.octaves}" seed="${doc.grain.seed}" stitchTiles="stitch" />${mono}<feComponentTransfer><feFuncA type="linear" slope="${doc.grain.amount}" intercept="0" /></feComponentTransfer></filter></defs><rect x="0" y="0" width="${doc.width}" height="${doc.height}" filter="url(#forge-grain)" style="mix-blend-mode:overlay" />`;
}

export function docToSvgString(doc: Doc): string {
  const hidden = getBooleanHiddenIds(doc.nodes);
  // Render in reverse so nodes[0] (top of sidebar) is painted last and ends
  // up visually in front — matches Figma/Photoshop layer ordering.
  const nodes = [...doc.nodes]
    .reverse()
    .filter((n) => n.enabled && !hidden.has(n.id))
    .map((n) => nodeSvg(n, doc.nodes))
    .join("");
  const bg = doc.backgroundEnabled
    ? `<rect x="0" y="0" width="${doc.width}" height="${doc.height}" fill="${escapeAttr(doc.background)}" />`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width}" height="${doc.height}">${bg}${nodes}${grainSvg(doc)}</svg>`;
}

export function downloadSvg(doc: Doc, filename: string): void {
  const blob = new Blob([docToSvgString(doc)], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(blob, filename);
}

export async function downloadPng(doc: Doc, filename: string, scale = 2): Promise<void> {
  const svg = docToSvgString(doc);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg failed to load"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = doc.width * scale;
    canvas.height = doc.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (out) triggerDownload(out, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
