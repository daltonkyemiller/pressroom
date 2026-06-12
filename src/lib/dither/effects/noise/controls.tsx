import { SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { NoiseParams } from "./runtime";

export const NoiseControls: ControlsComponent<NoiseParams> = ({
  params,
  onPatch,
  onStart,
  onCommit,
}) => (
  <SliderControl
    name="amount"
    min={0}
    max={100}
    value={params.amount}
    onStart={onStart}
    onCommit={onCommit}
    onChange={(v) => onPatch({ amount: v })}
  />
);
