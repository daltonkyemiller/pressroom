import { PaletteControl, SegControl, SliderControl, ToggleControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { HalftoneParams } from "./runtime";

export const HalftoneControls: ControlsComponent<HalftoneParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SliderControl name="cell size" min={1} max={24} value={p.size} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ size: v })} />
    <SliderControl name="angle" min={0} max={90} value={p.angle} unit="°"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ angle: v })} />
    <SliderControl name="dot spread" min={50} max={180} step={5} value={p.spread} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ spread: v })} />
    <SliderControl name="gooeyness" min={0} max={30} value={p.goo}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ goo: v })} />
    <SegControl name="shape" value={p.shape}
      options={[
        { value: "dot", label: "dot" },
        { value: "line", label: "line" },
        { value: "cross", label: "cross" },
        { value: "square", label: "square" },
      ]}
      onChange={(v) => onPatch({ shape: v })} />
    <PaletteControl name="palette" value={p.palette} onChange={(v) => onPatch({ palette: v })} />
    <ToggleControl name="preserve colors" value={p.preserveColors}
      onChange={(v) => onPatch({ preserveColors: v })} />
  </>
);
