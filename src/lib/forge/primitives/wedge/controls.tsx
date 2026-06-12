import { SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { WedgeParams } from "./runtime";

export const WedgeControls: ControlsComponent<WedgeParams> = ({ params, onPatch }) => (
  <>
    <SliderControl name="center x" min={-2000} max={2000} value={params.cx}
      onChange={(v) => onPatch({ cx: v })} />
    <SliderControl name="center y" min={-2000} max={2000} value={params.cy}
      onChange={(v) => onPatch({ cy: v })} />
    <SliderControl name="outer radius" min={0} max={2000} value={params.outerRadius}
      onChange={(v) => onPatch({ outerRadius: v })} />
    <SliderControl name="inner radius" min={0} max={2000} value={params.innerRadius}
      onChange={(v) => onPatch({ innerRadius: v })} />
    <SliderControl name="start angle" min={-360} max={360} value={params.startAngle} unit="°"
      onChange={(v) => onPatch({ startAngle: v })} />
    <SliderControl name="sweep" min={-360} max={360} value={params.sweep} unit="°"
      onChange={(v) => onPatch({ sweep: v })} />
  </>
);
