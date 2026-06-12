import { SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { ColorParams } from "./runtime";

export const ColorControls: ControlsComponent<ColorParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SliderControl name="contrast" min={-100} max={100} value={p.contrast}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ contrast: v })} />
    <SliderControl name="brightness" min={-100} max={100} value={p.brightness}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ brightness: v })} />
    <SliderControl name="midtones" min={0.3} max={3} step={0.05} value={p.gamma}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ gamma: v })} />
    <SliderControl name="saturation" min={0} max={200} value={p.saturation} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ saturation: v })} />
    <SliderControl name="temperature" min={-100} max={100} value={p.temperature}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ temperature: v })} />
    <SliderControl name="tint" min={-100} max={100} value={p.tint}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ tint: v })} />
  </>
);
