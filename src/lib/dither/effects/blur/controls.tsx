import { SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { BlurParams } from "./runtime";

export const BlurControls: ControlsComponent<BlurParams> = ({
  params,
  onPatch,
  onStart,
  onCommit,
}) => (
  <SliderControl
    name="radius"
    min={0}
    max={20}
    value={params.radius}
    onStart={onStart}
    onCommit={onCommit}
    onChange={(v) => onPatch({ radius: v })}
  />
);
