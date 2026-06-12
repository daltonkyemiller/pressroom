import { SliderControl } from "@/components/dither/controls";
import { LinkedSliders } from "@/components/forge/linked-sliders";
import type { ControlsComponent } from "../types";
import type { EllipseParams } from "./runtime";

export const EllipseControls: ControlsComponent<EllipseParams> = ({ params, onPatch }) => (
  <>
    <SliderControl name="center x" min={-2000} max={2000} value={params.cx}
      onChange={(v) => onPatch({ cx: v })} />
    <SliderControl name="center y" min={-2000} max={2000} value={params.cy}
      onChange={(v) => onPatch({ cy: v })} />
    <LinkedSliders aName="radius x" bName="radius y" aValue={params.rx} bValue={params.ry}
      min={0} max={2000} defaultLinked onChange={(rx, ry) => onPatch({ rx, ry })} />
  </>
);
