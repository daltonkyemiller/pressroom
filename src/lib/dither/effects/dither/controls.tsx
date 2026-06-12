import {
  ColorControl,
  PaletteControl,
  SegControl,
  SliderControl,
  ToggleControl,
} from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { DitherParams } from "./runtime";

export const DitherControls: ControlsComponent<DitherParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SegControl name="algorithm" cols={2} value={p.algo}
      options={[
        { value: "floyd", label: "floyd" },
        { value: "atkinson", label: "atkinson" },
        { value: "bayer4", label: "bayer 4×4" },
        { value: "bayer8", label: "bayer 8×8" },
        { value: "burkes", label: "burkes" },
        { value: "sierra", label: "sierra" },
        { value: "stucki", label: "stucki" },
        { value: "threshold", label: "threshold" },
      ]}
      onChange={(v) => onPatch({ algo: v })} />
    <PaletteControl name="palette" value={p.palette} onChange={(v) => onPatch({ palette: v })} />
    <SliderControl name="strength" min={0} max={100} value={p.strength} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ strength: v })} />
    <SliderControl name="pre-blur" min={0} max={5} value={p.preBlur} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ preBlur: v })} />
    <SliderControl name="diffusion" min={0} max={200} value={p.diffusion} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ diffusion: v })} />
    <SliderControl name="matrix scale" min={16} max={128} value={p.matrixScale}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ matrixScale: v })} />
    <SliderControl name="jitter" min={0} max={100} value={p.jitter} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ jitter: v })} />
    <ToggleControl name="serpentine scan" value={p.serpentine}
      onChange={(v) => onPatch({ serpentine: v })} />
    <ToggleControl name="preserve transparency" value={p.preserveTransparency}
      onChange={(v) => onPatch({ preserveTransparency: v })} />
    <ToggleControl name="preserve colors" value={p.preserveColors}
      onChange={(v) => onPatch({ preserveColors: v })} />
    {p.preserveColors && (
      <ColorControl name="ink color" value={p.inkColor}
        onChange={(v) => onPatch({ inkColor: v })} />
    )}
  </>
);
