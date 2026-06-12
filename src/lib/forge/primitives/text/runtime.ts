import type { PrimitiveModule } from "../types";
import { randJitter } from "../types";
import { getFontEntry } from "../../font-registry";

export type TextParams = {
  cx: number;
  cy: number;
  content: string;
  size: number;
  // CSS font-family value. Matched against the font registry to find an
  // opentype.Font for boolean ops; falls back to the literal string if not
  // registered (the browser may still render it if it's a system font).
  font: string;
  anchor: "start" | "middle" | "end";
  baseline: "hanging" | "middle" | "alphabetic";
  rotation: number;
  letterSpacing: number;
};

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cssFontFamily(family: string): string {
  return `"${family.replace(/"/g, '\\"')}", system-ui, sans-serif`;
}

export const text: PrimitiveModule<"text", TextParams> = {
  kind: "text",
  label: "Text",
  defaults: (c) => ({
    cx: c.x,
    cy: c.y,
    content: "FORGE",
    size: 120,
    font: "Mondwest",
    anchor: "middle",
    baseline: "middle",
    rotation: 0,
    letterSpacing: 0,
  }),
  randomize: (current, c) => {
    const r = Math.random;
    return {
      ...current,
      cx: randJitter(c.x, 200),
      cy: randJitter(c.y, 200),
      size: 60 + r() * 200,
      rotation: r() < 0.6 ? 0 : Math.floor((r() - 0.5) * 90),
      letterSpacing: Math.floor((r() - 0.5) * 20),
    };
  },
  getCenter: (p) => ({ x: p.cx, y: p.cy }),
  geometry: (p) => {
    const ff = cssFontFamily(p.font);
    const transform = p.rotation
      ? ` transform="rotate(${p.rotation} ${p.cx} ${p.cy})"`
      : "";
    const ls = p.letterSpacing ? ` letter-spacing="${p.letterSpacing}"` : "";
    return `<text x="${p.cx}" y="${p.cy}" font-family='${escapeAttr(ff)}' font-size="${p.size}" text-anchor="${p.anchor}" dominant-baseline="${p.baseline}"${ls}${transform}>${escapeText(p.content)}</text>`;
  },
  // Boolean ops can't operate on <text> — paper.js doesn't render glyphs.
  // Convert to outline paths via opentype.js. The anchor/baseline knobs
  // shift the origin to roughly match SVG <text>'s positioning.
  outlineGeometry: (p) => {
    const entry = getFontEntry(p.font);
    if (!entry?.font) return "";
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
  },
};
