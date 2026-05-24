// Prefabs are (palette, ctx) → Node factories that produce a fully-wired
// node with its primitive + modifier stack pre-configured. They're just
// in-memory recipes; nothing about prefab state lives in the doc itself.
// User-saved prefabs can be added later (probably backed by localStorage)
// without changing this file's shape.

import {
  makeNode,
  makePrimitive,
  nextModId,
  nextNodeId,
} from "./defaults";
import type {
  BarStackParams,
  EllipseParams,
  Modifier,
  Node,
  PolygonParams,
  WedgeParams,
} from "./types";

export type PrefabContext = {
  docCenter: { x: number; y: number };
  palette: string[];
};

export type Prefab = {
  id: string;
  name: string;
  description: string;
  build: (ctx: PrefabContext) => Node;
};

// Helper: pull N colors from the palette, repeating if needed.
function takeColors(palette: string[], n: number, fallback: string): string[] {
  if (palette.length === 0) return Array.from({ length: n }, () => fallback);
  return Array.from({ length: n }, (_, i) => palette[i % palette.length]);
}

export const PREFABS: Prefab[] = [
  {
    id: "totem-cross",
    name: "Totem cross",
    description: "Tapered bar stack, four-fold radial",
    build: ({ docCenter, palette }) => {
      const node = makeNode("barStack", nextNodeId());
      node.name = "Totem cross";
      const p = node.primitive.params as BarStackParams;
      p.cx = docCenter.x;
      p.cy = docCenter.y - 160;
      p.count = 14;
      p.width = 240;
      p.height = 12;
      p.gap = 8;
      p.taper = -100;
      node.fill = palette[0] ?? "#d96b29";
      node.modifiers = [
        {
          id: nextModId(),
          kind: "radialRepeat",
          enabled: true,
          params: { count: 4, cx: docCenter.x, cy: docCenter.y, arc: 360 },
        },
      ];
      return node;
    },
  },
  {
    id: "sunburst",
    name: "Sunburst",
    description: "Wedge fanned around the center",
    build: ({ docCenter, palette }) => {
      const node = makeNode("wedge", nextNodeId());
      node.name = "Sunburst";
      const p = node.primitive.params as WedgeParams;
      p.cx = docCenter.x;
      p.cy = docCenter.y;
      p.outerRadius = 240;
      p.innerRadius = 50;
      p.startAngle = -8;
      p.sweep = 16;
      node.fill = palette[0] ?? "#d96b29";
      node.modifiers = [
        {
          id: nextModId(),
          kind: "radialRepeat",
          enabled: true,
          params: { count: 16, cx: docCenter.x, cy: docCenter.y, arc: 360 },
        },
      ];
      return node;
    },
  },
  {
    id: "concentric-rings",
    name: "Concentric rings",
    description: "Shrinking circles with palette cycle",
    build: ({ docCenter, palette }) => {
      const node = makeNode("ellipse", nextNodeId());
      node.name = "Concentric rings";
      const p = node.primitive.params as EllipseParams;
      p.cx = docCenter.x;
      p.cy = docCenter.y;
      p.rx = 280;
      p.ry = 280;
      const colors = takeColors(palette, 6, node.fill);
      node.fill = colors[0];
      node.modifiers = [
        {
          id: nextModId(),
          kind: "linearRepeat",
          enabled: true,
          // Each step shrinks the previous by ~18% in place.
          params: { count: 8, dx: 0, dy: 0, dRotate: 0, dScale: -12 },
        },
        {
          id: nextModId(),
          kind: "colorCycle",
          enabled: true,
          params: { colors, mode: "cycle", seed: 1, affect: "fill" },
        },
      ] satisfies Modifier[];
      return node;
    },
  },
  {
    id: "tile-field",
    name: "Tile field",
    description: "Grid of squares cycling through the palette",
    build: ({ docCenter, palette }) => {
      const node = makeNode("rect", nextNodeId());
      node.name = "Tile field";
      const colors = takeColors(palette, Math.max(2, palette.length), node.fill);
      node.fill = colors[0];
      node.primitive = makePrimitive("rect");
      node.primitive.params = {
        cx: docCenter.x,
        cy: docCenter.y,
        w: 60,
        h: 60,
        rx: 0,
      };
      node.modifiers = [
        {
          id: nextModId(),
          kind: "gridRepeat",
          enabled: true,
          params: { countX: 7, countY: 7, dx: 80, dy: 80, staggerY: 0, cellRotate: 0 },
        },
        {
          id: nextModId(),
          kind: "colorCycle",
          enabled: true,
          params: { colors, mode: "random", seed: 7, affect: "fill" },
        },
      ];
      return node;
    },
  },
  {
    id: "pinwheel-star",
    name: "Pinwheel star",
    description: "Polygon star with radial spin",
    build: ({ docCenter, palette }) => {
      const node = makeNode("polygon", nextNodeId());
      node.name = "Pinwheel star";
      const p = node.primitive.params as PolygonParams;
      p.cx = docCenter.x;
      p.cy = docCenter.y;
      p.radius = 180;
      p.sides = 6;
      p.starInner = 0.4;
      node.fill = palette[0] ?? "#d96b29";
      node.modifiers = [
        {
          id: nextModId(),
          kind: "linearRepeat",
          enabled: true,
          params: { count: 6, dx: 0, dy: 0, dRotate: 6, dScale: -8 },
        },
      ];
      return node;
    },
  },
  {
    id: "halftone-burst",
    name: "Halftone burst",
    description: "Tapered bars at 8-fold symmetry",
    build: ({ docCenter, palette }) => {
      const node = makeNode("barStack", nextNodeId());
      node.name = "Halftone burst";
      const p = node.primitive.params as BarStackParams;
      p.cx = docCenter.x;
      p.cy = docCenter.y - 140;
      p.count = 18;
      p.width = 200;
      p.height = 8;
      p.gap = 6;
      p.taper = 100; // wide outer, narrow inner
      p.jitter = 30;
      node.fill = palette[0] ?? "#d96b29";
      node.modifiers = [
        {
          id: nextModId(),
          kind: "radialRepeat",
          enabled: true,
          params: { count: 8, cx: docCenter.x, cy: docCenter.y, arc: 360 },
        },
      ];
      return node;
    },
  },
];

export function findPrefab(id: string): Prefab | undefined {
  return PREFABS.find((p) => p.id === id);
}
