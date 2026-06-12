import { ColorControl, SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { RisoParams } from "./runtime";

export const RisoControls: ControlsComponent<RisoParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <ColorControl name="paper" value={p.paperColor}
      onChange={(v) => onPatch({ paperColor: v })} />
    <ColorControl name="ink 1" value={p.ink1Color}
      onChange={(v) => onPatch({ ink1Color: v })} />
    <SliderControl name="ink 1 threshold" min={0} max={100} value={p.threshold1} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ threshold1: v })} />
    <SliderControl name="ink 1 offset" min={0} max={20} step={0.5} value={p.offset1} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ offset1: v })} />
    <SliderControl name="ink 1 angle" min={0} max={360} value={p.angle1} unit="°"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ angle1: v })} />
    <SliderControl name="ink 1 grain" min={0} max={100} value={p.grain1} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ grain1: v })} />
    <ColorControl name="ink 2" value={p.ink2Color}
      onChange={(v) => onPatch({ ink2Color: v })} />
    <SliderControl name="ink 2 threshold" min={0} max={100} value={p.threshold2} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ threshold2: v })} />
    <SliderControl name="ink 2 offset" min={0} max={20} step={0.5} value={p.offset2} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ offset2: v })} />
    <SliderControl name="ink 2 angle" min={0} max={360} value={p.angle2} unit="°"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ angle2: v })} />
    <SliderControl name="ink 2 grain" min={0} max={100} value={p.grain2} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ grain2: v })} />
    <SliderControl name="softness" min={0} max={1} step={0.02} value={p.softness}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ softness: v })} />
    <SliderControl name="seed" min={0} max={9999} value={p.seed}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ seed: v })} />
  </>
);
