import { ColorControl, SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { DirtParams } from "./runtime";

export const DirtControls: ControlsComponent<DirtParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SliderControl name="amount" min={0} max={100} value={p.amount}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ amount: v })} />
    <SliderControl name="dust" min={0} max={100} value={p.dust}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ dust: v })} />
    <SliderControl name="scratches" min={0} max={100} value={p.scratches}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ scratches: v })} />
    <SliderControl name="hairs" min={0} max={100} value={p.hairs}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ hairs: v })} />
    <SliderControl name="size" min={0.3} max={4} step={0.1} value={p.size}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ size: v })} />
    <SliderControl name="intensity" min={0} max={100} value={p.intensity} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ intensity: v })} />
    <SliderControl name="darkness mix" min={0} max={100} value={p.darkness} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ darkness: v })} />
    <ColorControl name="dark color" value={p.color} onChange={(v) => onPatch({ color: v })} />
    <SliderControl name="seed" min={0} max={9999} value={p.seed}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ seed: v })} />
  </>
);
