import { SliderControl } from "@/components/dither/controls";
import { LinkedSliders } from "@/components/forge/linked-sliders";
import type { ControlsComponent } from "../types";
import type { ScatterParams } from "./runtime";

export const ScatterControls: ControlsComponent<ScatterParams> = ({ params, onPatch }) => (
  <>
    <LinkedSliders aName="offset x" bName="offset y"
      aValue={params.offsetX} bValue={params.offsetY}
      min={0} max={500} defaultLinked
      onChange={(offsetX, offsetY) => onPatch({ offsetX, offsetY })} />
    <SliderControl name="rotation" min={0} max={180} value={params.rotation} unit="°"
      onChange={(v) => onPatch({ rotation: v })} />
    <SliderControl name="scale" min={0} max={1} step={0.02} value={params.scale}
      onChange={(v) => onPatch({ scale: v })} />
    <SliderControl name="seed" min={0} max={9999} value={params.seed}
      onChange={(v) => onPatch({ seed: v })} />
  </>
);
