import { ColorControl, SliderControl, ToggleControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { DuotoneParams } from "../../shader-duotone";

export const DuotoneControls: ControlsComponent<DuotoneParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SliderControl name="cell size" min={2} max={48} value={p.tile} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ tile: v })} />
    <SliderControl name="length" min={0} max={2} step={0.05} value={p.lengthScale}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ lengthScale: v })} />
    <SliderControl name="thickness" min={0.02} max={1} step={0.02} value={p.thickness}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ thickness: v })} />
    <SliderControl name="brightness offset" min={-0.5} max={0.5} step={0.02} value={p.brightnessOffset}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ brightnessOffset: v })} />
    <SliderControl name="contrast" min={0.5} max={3} step={0.05} value={p.contrast}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ contrast: v })} />
    <SliderControl name="blur radius" min={0} max={20} value={p.blurRadius} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ blurRadius: v })} />
    <SliderControl name="blur passes" min={0} max={3} value={p.blurPasses}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ blurPasses: v })} />
    <SliderControl name="gradient align" min={0} max={1} step={0.05} value={p.gradientAlign}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ gradientAlign: v })} />
    <SliderControl name="back opacity" min={0} max={1} step={0.05} value={p.backOpacity}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ backOpacity: v })} />
    <ColorControl name="dash color" value={p.dashColor}
      onChange={(v) => onPatch({ dashColor: v })} />
    <ColorControl name="back color" value={p.backColor}
      onChange={(v) => onPatch({ backColor: v })} />
    <ToggleControl name="original colors" value={p.originalColors}
      onChange={(v) => onPatch({ originalColors: v })} />
    <ToggleControl name="inverted" value={p.inverted}
      onChange={(v) => onPatch({ inverted: v })} />
  </>
);
