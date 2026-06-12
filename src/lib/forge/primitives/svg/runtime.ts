import type { PrimitiveModule } from "../types";
import { randJitter } from "../types";

export type SvgParams = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  // Raw SVG markup as the user pasted or uploaded it. Parsed lazily at
  // render time so a transform places it at (cx, cy) and scales it to
  // (width, height).
  content: string;
};

// Placeholder so a freshly-added SVG primitive renders SOMETHING — a
// 5-point star at 0..100 viewBox. Replaced when the user pastes / uploads.
const PLACEHOLDER_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 61,38 95,38 67,57 78,90 50,70 22,90 33,57 5,38 39,38" /></svg>`;

type ParsedSvg = { viewBox: [number, number, number, number]; body: string };
const svgParseCache = new Map<string, ParsedSvg>();

export function parseSvgContent(content: string): ParsedSvg {
  const cached = svgParseCache.get(content);
  if (cached) return cached;
  let viewBox: [number, number, number, number] = [0, 0, 100, 100];
  let body = "";
  try {
    const doc = new DOMParser().parseFromString(content, "image/svg+xml");
    const root = doc.documentElement;
    // parseFromString returns a <parsererror> doc on malformed input.
    if (root && root.nodeName !== "parsererror") {
      const vb = root.getAttribute("viewBox");
      if (vb) {
        const parts = vb.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
          viewBox = [parts[0], parts[1], parts[2], parts[3]];
        }
      } else {
        const w = parseFloat(root.getAttribute("width") || "");
        const h = parseFloat(root.getAttribute("height") || "");
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
          viewBox = [0, 0, w, h];
        }
      }
      body = root.innerHTML;
    }
  } catch {
    // Leave defaults; the SVG primitive will render an empty <g>.
  }
  const parsed: ParsedSvg = { viewBox, body };
  if (svgParseCache.size > 64) svgParseCache.clear(); // crude LRU cap
  svgParseCache.set(content, parsed);
  return parsed;
}

// Outer placement <g> for an SVG primitive: translate to (cx, cy), scale
// to (width, height), and shift the viewBox origin to 0,0.
export function svgPlacementTransform(p: {
  cx: number;
  cy: number;
  width: number;
  height: number;
  content: string;
}): { transform: string; body: string } | null {
  const { viewBox, body } = parseSvgContent(p.content);
  const [vx, vy, vw, vh] = viewBox;
  if (vw <= 0 || vh <= 0 || !body) return null;
  const sx = p.width / vw;
  const sy = p.height / vh;
  const tx = p.cx - p.width / 2;
  const ty = p.cy - p.height / 2;
  const transform = `translate(${tx} ${ty}) scale(${sx} ${sy}) translate(${-vx} ${-vy})`;
  return { transform, body };
}

function placedSvg(p: SvgParams): string {
  const placed = svgPlacementTransform(p);
  if (!placed) return "";
  return `<g transform="${placed.transform}">${placed.body}</g>`;
}

export const svg: PrimitiveModule<"svg", SvgParams> = {
  kind: "svg",
  label: "SVG",
  defaults: (c) => ({
    cx: c.x,
    cy: c.y,
    width: 300,
    height: 300,
    content: PLACEHOLDER_SVG,
  }),
  // Randomize position + size only; randomizing the loaded markup makes no
  // sense.
  randomize: (current, c) => {
    const r = Math.random;
    return {
      ...current,
      cx: randJitter(c.x, 200),
      cy: randJitter(c.y, 200),
      width: 120 + r() * 320,
      height: 120 + r() * 320,
    };
  },
  getCenter: (p) => ({ x: p.cx, y: p.cy }),
  geometry: placedSvg,
};
