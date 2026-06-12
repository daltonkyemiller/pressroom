import { SliderControl } from "@/components/dither/controls";
import { LinkedSliders } from "@/components/forge/linked-sliders";
import type { ControlsComponent } from "../types";
import type { RectParams } from "./runtime";

export const RectControls: ControlsComponent<RectParams> = ({ params, onPatch }) => (
  <>
    <SliderControl name="center x" min={-2000} max={2000} value={params.cx}
      onChange={(v) => onPatch({ cx: v })} />
    <SliderControl name="center y" min={-2000} max={2000} value={params.cy}
      onChange={(v) => onPatch({ cy: v })} />
    <LinkedSliders aName="width" bName="height" aValue={params.w} bValue={params.h}
      min={0} max={2000} onChange={(w, h) => onPatch({ w, h })} />
    <SliderControl name="corner radius" min={0} max={500} value={params.rx}
      onChange={(v) => onPatch({ rx: v })} />
  </>
);
