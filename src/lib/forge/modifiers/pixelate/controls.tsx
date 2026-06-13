import { SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { PixelateParams } from "./runtime";

export const PixelateControls: ControlsComponent<PixelateParams> = ({ params, onPatch }) => (
  <>
    <SliderControl name="cell size" min={2} max={80} value={params.cellSize} unit="px"
      onChange={(v) => onPatch({ cellSize: v })} />
    <SliderControl name="alpha threshold" min={0} max={255} value={params.alphaThreshold}
      onChange={(v) => onPatch({ alphaThreshold: v })} />
    <SliderControl name="opacity" min={0} max={1} step={0.05} value={params.opacityScale}
      onChange={(v) => onPatch({ opacityScale: v })} />
  </>
);
