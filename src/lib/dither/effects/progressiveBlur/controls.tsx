import { SegControl, SliderControl, ToggleControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { ProgressiveBlurParams } from "../../progressive-blur";

export const ProgressiveBlurControls: ControlsComponent<ProgressiveBlurParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SegControl name="direction" value={p.direction}
      options={[{ value: "linear", label: "linear" }, { value: "radial", label: "radial" }]}
      onChange={(v) => onPatch({ direction: v })} />
    <SliderControl name="max radius" min={0} max={40} value={p.maxRadius} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ maxRadius: v })} />
    <SliderControl name="start" min={0} max={100} value={p.start} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ start: v })} />
    <SliderControl name="end" min={0} max={100} value={p.end} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ end: v })} />
    <SliderControl name="curve" min={0.3} max={3} step={0.05} value={p.curve}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ curve: v })} />
    {p.direction === "linear" ? (
      <SliderControl name="angle" min={0} max={360} value={p.angle} unit="°"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ angle: v })} />
    ) : (
      <>
        <SliderControl name="center x" min={0} max={100} value={p.centerX} unit="%"
          onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ centerX: v })} />
        <SliderControl name="center y" min={0} max={100} value={p.centerY} unit="%"
          onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ centerY: v })} />
      </>
    )}
    <ToggleControl name="invert" value={p.invert} onChange={(v) => onPatch({ invert: v })} />
  </>
);
