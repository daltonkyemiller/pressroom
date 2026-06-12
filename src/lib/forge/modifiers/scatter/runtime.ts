import type { ModifierModule } from "../types";

export type ScatterParams = {
  offsetX: number; // max abs random x offset
  offsetY: number; // max abs random y offset
  rotation: number; // max abs random rotation in degrees
  scale: number; // 0..1 — random scale variation (1 ± scale)
  seed: number;
};

export const scatter: ModifierModule<"scatter", ScatterParams> = {
  kind: "scatter",
  label: "Scatter",
  defaults: () => ({ offsetX: 20, offsetY: 20, rotation: 15, scale: 0.1, seed: 1 }),
  apply(instances, params, ctx) {
    const { pivot, composeTransform, hashSigned } = ctx;
    // Adds per-instance random offset/rotation/scale to existing instances.
    // Doesn't multiply count — operates on whatever's already been produced.
    return instances.map((inst, i) => {
      const r1 = hashSigned(params.seed, i * 4 + 0);
      const r2 = hashSigned(params.seed, i * 4 + 1);
      const r3 = hashSigned(params.seed, i * 4 + 2);
      const r4 = hashSigned(params.seed, i * 4 + 3);
      const dx = r1 * params.offsetX;
      const dy = r2 * params.offsetY;
      const dAngle = r3 * params.rotation;
      const s = 1 + r4 * params.scale;
      const t = `translate(${dx.toFixed(3)} ${dy.toFixed(3)}) rotate(${dAngle.toFixed(3)} ${pivot.x} ${pivot.y}) translate(${pivot.x} ${pivot.y}) scale(${s.toFixed(4)}) translate(${-pivot.x} ${-pivot.y})`;
      return { ...inst, transform: composeTransform(inst.transform, t) };
    });
  },
};
