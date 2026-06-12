import type { EffectModule } from "../types";
import { PALETTES, type PaletteId } from "../../palettes";
import { boxBlur } from "../utils";

export type HalftoneShape = "dot" | "line" | "cross" | "square";
export type HalftoneParams = {
  size: number;
  angle: number;
  shape: HalftoneShape;
  palette: PaletteId;
  goo: number;
  spread: number;
  preserveColors: boolean;
};

export const halftone: EffectModule<"halftone", HalftoneParams> = {
  kind: "halftone",
  label: "Halftone",
  description: "dot tone",
  defaults: {
    size: 8,
    angle: 45,
    shape: "dot",
    palette: "bw",
    goo: 0,
    spread: 100,
    preserveColors: false,
  },
  apply(img, p) {
    const w = img.width;
    const h = img.height;
    const src = img.data;
    const palette = PALETTES[p.palette];

    let lightest = palette[0];
    let darkest = palette[0];
    let lL = -1;
    let dL = 256;
    for (const c of palette) {
      const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      if (L > lL) {
        lL = L;
        lightest = c;
      }
      if (L < dL) {
        dL = L;
        darkest = c;
      }
    }

    const shapes = new OffscreenCanvas(w, h);
    const sctx = shapes.getContext("2d")!;
    if (!p.preserveColors) {
      sctx.fillStyle = `rgb(${darkest[0]},${darkest[1]},${darkest[2]})`;
    }

    const size = p.size;
    const spread = (p.spread || 100) / 100;
    const angle = (p.angle * Math.PI) / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const diag = Math.ceil(Math.sqrt(w * w + h * h));
    const steps = Math.ceil(diag / size) + 2;
    const cx = w / 2;
    const cy = h / 2;

    for (let gy = -steps; gy <= steps; gy++) {
      for (let gx = -steps; gx <= steps; gx++) {
        const rx = gx * size;
        const ry = gy * size;
        const x = cosA * rx - sinA * ry + cx;
        const y = sinA * rx + cosA * ry + cy;
        if (x < -size || x > w + size || y < -size || y > h + size) continue;

        const sx = Math.max(0, Math.min(w - 1, Math.floor(x)));
        const sy = Math.max(0, Math.min(h - 1, Math.floor(y)));
        const i = (sy * w + sx) * 4;
        const L = (0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]) / 255;
        const ink = 1 - L;
        if (ink < 0.02) continue;

        if (p.preserveColors) {
          sctx.fillStyle = `rgb(${src[i]},${src[i + 1]},${src[i + 2]})`;
        }

        if (p.shape === "dot") {
          const r = size * 0.55 * spread * Math.sqrt(ink);
          sctx.beginPath();
          sctx.arc(x, y, r, 0, Math.PI * 2);
          sctx.fill();
        } else if (p.shape === "square") {
          const s = size * spread * Math.sqrt(ink);
          sctx.save();
          sctx.translate(x, y);
          sctx.rotate(angle);
          sctx.fillRect(-s / 2, -s / 2, s, s);
          sctx.restore();
        } else if (p.shape === "line") {
          const len = size * 1.1 * spread;
          const thick = size * ink * spread;
          sctx.save();
          sctx.translate(x, y);
          sctx.rotate(angle);
          sctx.fillRect(-len / 2, -thick / 2, len, thick);
          sctx.restore();
        } else if (p.shape === "cross") {
          const len = size * 0.9 * spread;
          const thick = size * 0.5 * ink * spread;
          sctx.save();
          sctx.translate(x, y);
          sctx.rotate(angle);
          sctx.fillRect(-len / 2, -thick / 2, len, thick);
          sctx.fillRect(-thick / 2, -len / 2, thick, len);
          sctx.restore();
        }
      }
    }

    let inkLayer: OffscreenCanvas = shapes;
    if (p.goo > 0) {
      // Three box passes approximate gaussian; alpha is then snapped via
      // the same linear ramp the old SVG matrix used (a' = 20a - 9 in
      // 0..1 space).
      const blurAmount = (p.goo / 30) * (size * 0.6);
      const r = Math.max(1, Math.round(blurAmount));
      const gImg = sctx.getImageData(0, 0, w, h);
      const gd = gImg.data;
      boxBlur(gd, w, h, r, 4);
      boxBlur(gd, w, h, r, 4);
      boxBlur(gd, w, h, r, 4);
      for (let i = 3; i < gd.length; i += 4) {
        const t = 20 * gd[i] - 9 * 255;
        gd[i] = t < 0 ? 0 : t > 255 ? 255 : t;
      }
      const gooed = new OffscreenCanvas(w, h);
      gooed.getContext("2d")!.putImageData(gImg, 0, 0);
      inkLayer = gooed;
    }

    const out = new OffscreenCanvas(w, h);
    const octx = out.getContext("2d")!;
    if (p.preserveColors) {
      octx.fillStyle = "rgb(255,255,255)";
    } else {
      octx.fillStyle = `rgb(${lightest[0]},${lightest[1]},${lightest[2]})`;
    }
    octx.fillRect(0, 0, w, h);
    octx.drawImage(inkLayer, 0, 0);

    return octx.getImageData(0, 0, w, h);
  },
  summarize: (p) =>
    `${p.shape} · ${p.size}px · ${p.angle}°${p.goo > 0 ? ` · goo ${p.goo}` : ""}`,
};
