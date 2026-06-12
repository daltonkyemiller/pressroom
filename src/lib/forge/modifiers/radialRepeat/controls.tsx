import { SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { RadialRepeatParams } from "./runtime";

export const RadialRepeatControls: ControlsComponent<RadialRepeatParams> = ({
  params,
  onPatch,
}) => (
  <>
    <SliderControl name="count" min={1} max={60} value={params.count}
      onChange={(v) => onPatch({ count: v })} />
    <SliderControl name="arc" min={0} max={360} value={params.arc} unit="°"
      onChange={(v) => onPatch({ arc: v })} />
    <SliderControl name="center x" min={-2000} max={2000} value={params.cx}
      onChange={(v) => onPatch({ cx: v })} />
    <SliderControl name="center y" min={-2000} max={2000} value={params.cy}
      onChange={(v) => onPatch({ cy: v })} />
  </>
);
