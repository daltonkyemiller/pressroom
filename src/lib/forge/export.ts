// SVG + PNG export. SVG is built as a string (faster + no SSR dep than
// react-dom/server). PNG rasterizes the SVG via a Blob URL onto a canvas.

import {
  expandNode,
  getBooleanHiddenIds,
  polygonPath,
  wedgePath,
  type ClipDef,
} from "./engine";
import type { Doc, Node, Primitive } from "./types";

const FONT_FAMILIES: Record<string, string> = {
  mondwest: '"Mondwest", serif',
  "geist-pixel": '"Geist Pixel", monospace',
  "neue-bit": '"Neue Bit", monospace',
  sans: "system-ui, sans-serif",
};

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function primitiveSvg(primitive: Primitive): string {
  switch (primitive.kind) {
    case "rect": {
      const p = primitive.params;
      const rx = p.rx > 0 ? ` rx="${p.rx}"` : "";
      return `<rect x="${p.cx - p.w / 2}" y="${p.cy - p.h / 2}" width="${p.w}" height="${p.h}"${rx} />`;
    }
    case "ellipse": {
      const p = primitive.params;
      return `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" />`;
    }
    case "barStack": {
      // One base rect — per-instance transforms (from barStackInstances)
      // position each bar.
      const p = primitive.params;
      return `<rect x="${p.cx - p.width / 2}" y="${p.cy - p.height / 2}" width="${p.width}" height="${p.height}" />`;
    }
    case "wedge":
      return `<path d="${wedgePath(primitive.params)}" />`;
    case "polygon":
      return `<path d="${polygonPath(primitive.params)}" />`;
    case "text": {
      const p = primitive.params;
      const ff = FONT_FAMILIES[p.font] ?? FONT_FAMILIES.sans;
      const transform = p.rotation
        ? ` transform="rotate(${p.rotation} ${p.cx} ${p.cy})"`
        : "";
      const ls = p.letterSpacing ? ` letter-spacing="${p.letterSpacing}"` : "";
      return `<text x="${p.cx}" y="${p.cy}" font-family='${escapeAttr(ff)}' font-size="${p.size}" text-anchor="${p.anchor}" dominant-baseline="${p.baseline}"${ls}${transform}>${escapeText(p.content)}</text>`;
    }
  }
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
  const fillVal = node.fillEnabled ? node.fill : "none";
  const strokeVal = node.strokeEnabled ? node.stroke : "none";
  const strokeW = node.strokeEnabled ? node.strokeWidth : 0;
  const nodeAttrs = `fill="${escapeAttr(fillVal)}" stroke="${escapeAttr(strokeVal)}" stroke-width="${strokeW}" opacity="${node.opacity}"`;
  const body = instances
    .map((inst) => {
      const t = inst.transform ? ` transform="${escapeAttr(inst.transform.trim())}"` : "";
      const cp = inst.clipPathId ? ` clip-path="url(#${inst.clipPathId})"` : "";
      const fill = inst.fill ? ` fill="${escapeAttr(inst.fill)}"` : "";
      const stroke = inst.stroke ? ` stroke="${escapeAttr(inst.stroke)}"` : "";
      const op = inst.opacity != null ? ` opacity="${inst.opacity}"` : "";
      const shape = inst.pathOverride
        ? `<path d="${inst.pathOverride}" />`
        : primitiveSvg(node.primitive);
      return `<g${t}${cp}${fill}${stroke}${op}>${shape}</g>`;
    })
    .join("");
  return `${defs}<g ${nodeAttrs}>${body}</g>`;
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
