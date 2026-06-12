import { SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { BarStackParams } from "./runtime";

export const BarStackControls: ControlsComponent<BarStackParams> = ({ params, onPatch }) => (
  <>
    <SliderControl name="count" min={1} max={60} value={params.count}
      onChange={(v) => onPatch({ count: v })} />
    <SliderControl name="width" min={0} max={2000} value={params.width} unit="px"
      onChange={(v) => onPatch({ width: v })} />
    <SliderControl name="bar height" min={0.5} max={80} step={0.5} value={params.height} unit="px"
      onChange={(v) => onPatch({ height: v })} />
    <SliderControl name="gap" min={0} max={60} value={params.gap} unit="px"
      onChange={(v) => onPatch({ gap: v })} />
    <SliderControl name="taper" min={-100} max={100} value={params.taper}
      onChange={(v) => onPatch({ taper: v })} />
    <SliderControl name="jitter" min={0} max={100} value={params.jitter} unit="%"
      onChange={(v) => onPatch({ jitter: v })} />
    <SliderControl name="seed" min={0} max={9999} value={params.seed}
      onChange={(v) => onPatch({ seed: v })} />
    <SliderControl name="rotation" min={0} max={360} value={params.rotation} unit="°"
      onChange={(v) => onPatch({ rotation: v })} />
    <SliderControl name="center x" min={-2000} max={2000} value={params.cx}
      onChange={(v) => onPatch({ cx: v })} />
    <SliderControl name="center y" min={-2000} max={2000} value={params.cy}
      onChange={(v) => onPatch({ cy: v })} />
  </>
);
