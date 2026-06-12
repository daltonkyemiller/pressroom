import { SegControl, SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { ChromaticParams } from "./runtime";

export const ChromaticControls: ControlsComponent<ChromaticParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SegControl name="mode" value={p.mode}
      options={[
        { value: "linear", label: "linear" },
        { value: "radial", label: "radial" },
      ]}
      onChange={(v) => onPatch({ mode: v })} />
    <SliderControl name="amount" min={0} max={40} value={p.amount} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ amount: v })} />
    {p.mode === "linear" && (
      <SliderControl name="angle" min={0} max={360} value={p.angle} unit="°"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ angle: v })} />
    )}
  </>
);
