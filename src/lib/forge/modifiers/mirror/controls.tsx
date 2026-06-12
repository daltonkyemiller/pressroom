import { SegControl, SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { MirrorParams } from "./runtime";

export const MirrorControls: ControlsComponent<MirrorParams> = ({ params, onPatch }) => (
  <>
    <SegControl name="axis" value={params.axis}
      options={[
        { value: "x", label: "horizontal" },
        { value: "y", label: "vertical" },
      ]}
      onChange={(v) => onPatch({ axis: v })} />
    <SliderControl
      name={params.axis === "x" ? "y line" : "x line"}
      min={-2000} max={2000} value={params.center}
      onChange={(v) => onPatch({ center: v })} />
  </>
);
