import type { ModifierModule } from "../types";
import type { Instance } from "../../engine";

export type GridRepeatParams = {
  countX: number;
  countY: number;
  dx: number;
  dy: number;
  staggerY: number; // x-offset added to odd rows (brick pattern when > 0)
  cellRotate: number; // degrees added per cell index (i + j)
};

export const gridRepeat: ModifierModule<"gridRepeat", GridRepeatParams> = {
  kind: "gridRepeat",
  label: "Grid repeat",
  defaults: () => ({ countX: 4, countY: 4, dx: 80, dy: 80, staggerY: 0, cellRotate: 0 }),
  apply(instances, params, ctx) {
    const out: Instance[] = [];
    const nx = Math.max(1, Math.floor(params.countX));
    const ny = Math.max(1, Math.floor(params.countY));
    const { pivot, composeTransform } = ctx;
    // Center the grid on the pivot so adding a grid doesn't fling the
    // shape into the corner.
    const offsetX = -((nx - 1) * params.dx) / 2;
    const offsetY = -((ny - 1) * params.dy) / 2;
    for (const inst of instances) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const stagger = j % 2 === 1 ? params.staggerY : 0;
          const tx = offsetX + i * params.dx + stagger;
          const ty = offsetY + j * params.dy;
          const angle = (i + j) * params.cellRotate;
          const t = `translate(${tx} ${ty}) rotate(${angle} ${pivot.x} ${pivot.y})`;
          out.push({ ...inst, transform: composeTransform(inst.transform, t) });
        }
      }
    }
    return out;
  },
};
