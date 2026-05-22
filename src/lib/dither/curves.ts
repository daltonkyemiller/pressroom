// Per-channel curves: composite RGB + R + G + B. Build a 256-entry LUT
// from a list of control points using monotonic cubic Hermite interpolation
// (Fritsch–Carlson), which keeps the curve from overshooting between points.

export type CurvePoint = { x: number; y: number };
export type CurveChannel = "rgb" | "r" | "g" | "b";

export type CurvesParams = {
  rgb: CurvePoint[];
  r: CurvePoint[];
  g: CurvePoint[];
  b: CurvePoint[];
  activeChannel: CurveChannel;
};

const IDENTITY: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

export const CURVES_DEFAULTS: CurvesParams = {
  rgb: [...IDENTITY],
  r: [...IDENTITY],
  g: [...IDENTITY],
  b: [...IDENTITY],
  activeChannel: "rgb",
};

export function isIdentityCurve(points: CurvePoint[]): boolean {
  if (points.length !== 2) return false;
  return (
    points[0].x === 0 &&
    points[0].y === 0 &&
    points[1].x === 1 &&
    points[1].y === 1
  );
}

function clamp(n: number, lo: number, hi: number) {
  return n < lo ? lo : n > hi ? hi : n;
}

function buildLUT(controlPoints: CurvePoint[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const pts = [...controlPoints].sort((a, b) => a.x - b.x);
  const n = pts.length;

  if (n === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  if (n === 1) {
    const v = Math.round(clamp(pts[0].y, 0, 1) * 255);
    for (let i = 0; i < 256; i++) lut[i] = v;
    return lut;
  }

  const dxs = new Float64Array(n - 1);
  const ms = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    dxs[i] = Math.max(1e-6, pts[i + 1].x - pts[i].x);
    ms[i] = (pts[i + 1].y - pts[i].y) / dxs[i];
  }
  const tangents = new Float64Array(n);
  tangents[0] = ms[0];
  tangents[n - 1] = ms[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (ms[i - 1] * ms[i] <= 0) tangents[i] = 0;
    else tangents[i] = (ms[i - 1] + ms[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (ms[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i] / ms[i];
      const b = tangents[i + 1] / ms[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        tangents[i] = t * a * ms[i];
        tangents[i + 1] = t * b * ms[i];
      }
    }
  }

  let seg = 0;
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    if (x <= pts[0].x) {
      lut[i] = Math.round(clamp(pts[0].y, 0, 1) * 255);
      continue;
    }
    if (x >= pts[n - 1].x) {
      lut[i] = Math.round(clamp(pts[n - 1].y, 0, 1) * 255);
      continue;
    }
    while (seg < n - 1 && x > pts[seg + 1].x) seg++;
    const h = dxs[seg];
    const t = (x - pts[seg].x) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const y =
      h00 * pts[seg].y +
      h10 * h * tangents[seg] +
      h01 * pts[seg + 1].y +
      h11 * h * tangents[seg + 1];
    lut[i] = Math.max(0, Math.min(255, Math.round(y * 255)));
  }
  return lut;
}

export function applyCurves(img: ImageData, p: CurvesParams): ImageData {
  const lutRGB = buildLUT(p.rgb);
  const lutR = buildLUT(p.r);
  const lutG = buildLUT(p.g);
  const lutB = buildLUT(p.b);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lutR[lutRGB[data[i]]];
    data[i + 1] = lutG[lutRGB[data[i + 1]]];
    data[i + 2] = lutB[lutRGB[data[i + 2]]];
  }
  return img;
}

// Sample the curve at a fixed resolution for previewing the path in SVG.
export function sampleCurve(points: CurvePoint[], steps = 64): CurvePoint[] {
  const lut = buildLUT(points);
  const out: CurvePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const idx = Math.round(x * 255);
    out.push({ x, y: lut[idx] / 255 });
  }
  return out;
}
