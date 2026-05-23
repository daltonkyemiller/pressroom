// SVG + PNG export. SVG is built as a string (faster + no SSR dep than
// react-dom/server). PNG rasterizes the SVG via a Blob URL onto a canvas.

import { barStackBars, expandNode, type ClipDef } from "./engine";
import type { Doc, Node, Primitive } from "./types";

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function primitiveSvg(primitive: Primitive): string {
  switch (primitive.kind) {
    case "rect": {
      const p = primitive.params;
      const rx = p.rx > 0 ? ` rx="${p.rx}"` : "";
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"${rx} />`;
    }
    case "ellipse": {
      const p = primitive.params;
      return `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" />`;
    }
    case "barStack": {
      const p = primitive.params;
      const bars = barStackBars(p)
        .map((b) => `<rect x="${b.x.toFixed(2)}" y="${b.y.toFixed(2)}" width="${b.w.toFixed(2)}" height="${b.h.toFixed(2)}" />`)
        .join("");
      if (p.rotation) {
        return `<g transform="rotate(${p.rotation} ${p.cx} ${p.cy})">${bars}</g>`;
      }
      return bars;
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

function nodeSvg(node: Node): string {
  const { instances, clipDefs } = expandNode(node);
  const defs = clipDefs.length > 0 ? `<defs>${clipDefs.map(clipDefSvg).join("")}</defs>` : "";
  const styleAttr = `fill="${escapeAttr(node.fill)}" stroke="${escapeAttr(node.stroke)}" stroke-width="${node.strokeWidth}" opacity="${node.opacity}"`;
  const body = instances
    .map((inst) => {
      const t = inst.transform ? ` transform="${escapeAttr(inst.transform.trim())}"` : "";
      const cp = inst.clipPathId ? ` clip-path="url(#${inst.clipPathId})"` : "";
      return `<g${t}${cp}>${primitiveSvg(node.primitive)}</g>`;
    })
    .join("");
  return `${defs}<g ${styleAttr}>${body}</g>`;
}

export function docToSvgString(doc: Doc): string {
  const nodes = doc.nodes.filter((n) => n.enabled).map(nodeSvg).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width}" height="${doc.height}"><rect x="0" y="0" width="${doc.width}" height="${doc.height}" fill="${escapeAttr(doc.background)}" />${nodes}</svg>`;
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
