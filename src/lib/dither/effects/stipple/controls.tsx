import { ColorControl, SliderControl, ToggleControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { StippleParams } from "./runtime";

export const StippleControls: ControlsComponent<StippleParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SliderControl name="density" min={2} max={50} value={p.density} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ density: v })} />
    <SliderControl name="min size" min={0} max={20} step={0.1} value={p.minSize} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ minSize: v })} />
    <SliderControl name="max size" min={0} max={30} step={0.1} value={p.maxSize} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ maxSize: v })} />
    <SliderControl name="threshold" min={0} max={100} value={p.threshold} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ threshold: v })} />
    <SliderControl name="jitter" min={0} max={100} value={p.jitter} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ jitter: v })} />
    <SliderControl name="seed" min={0} max={9999} value={p.seed}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ seed: v })} />
    <ColorControl name="ink" value={p.inkColor} onChange={(v) => onPatch({ inkColor: v })} />
    <ToggleControl name="paper background" value={p.bgEnabled}
      onChange={(v) => onPatch({ bgEnabled: v })} />
    {p.bgEnabled && (
      <ColorControl name="paper" value={p.bgColor}
        onChange={(v) => onPatch({ bgColor: v })} />
    )}
    <ToggleControl name="preserve colors" value={p.preserveColors}
      onChange={(v) => onPatch({ preserveColors: v })} />
  </>
);
