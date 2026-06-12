import { SegControl, SliderControl, ToggleControl } from "@/components/dither/controls";
import { LinkedSliders } from "@/components/forge/linked-sliders";
import type { ControlsComponent } from "../types";
import type { ClipParams } from "./runtime";

export const ClipControls: ControlsComponent<ClipParams> = ({ params, onPatch }) => (
  <>
    <SegControl name="shape" value={params.shape}
      options={[
        { value: "ellipse", label: "ellipse" },
        { value: "rect", label: "rect" },
      ]}
      onChange={(v) => onPatch({ shape: v })} />
    <SliderControl name="center x" min={-2000} max={2000} value={params.cx}
      onChange={(v) => onPatch({ cx: v })} />
    <SliderControl name="center y" min={-2000} max={2000} value={params.cy}
      onChange={(v) => onPatch({ cy: v })} />
    <LinkedSliders aName="width" bName="height"
      aValue={params.w} bValue={params.h}
      min={0} max={4000} defaultLinked
      onChange={(w, h) => onPatch({ w, h })} />
    <ToggleControl name="invert (keep outside)" value={params.invert}
      onChange={(v) => onPatch({ invert: v })} />
  </>
);
