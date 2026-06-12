import { SliderControl } from "@/components/dither/controls";
import { LinkedSliders } from "@/components/forge/linked-sliders";
import type { ControlsComponent } from "../types";
import type { LinearRepeatParams } from "./runtime";

export const LinearRepeatControls: ControlsComponent<LinearRepeatParams> = ({
  params,
  onPatch,
}) => (
  <>
    <SliderControl name="count" min={1} max={60} value={params.count}
      onChange={(v) => onPatch({ count: v })} />
    <LinkedSliders aName="step x" bName="step y" aValue={params.dx} bValue={params.dy}
      min={-500} max={500} onChange={(dx, dy) => onPatch({ dx, dy })} />
    <SliderControl name="rotate / step" min={-180} max={180} value={params.dRotate} unit="°"
      onChange={(v) => onPatch({ dRotate: v })} />
    <SliderControl name="scale / step" min={-50} max={50} value={params.dScale} unit="%"
      onChange={(v) => onPatch({ dScale: v })} />
  </>
);
