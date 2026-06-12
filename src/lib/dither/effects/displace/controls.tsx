import { SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { DisplaceParams } from "./runtime";

export const DisplaceControls: ControlsComponent<DisplaceParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SliderControl name="amount" min={0} max={80} value={p.amount} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ amount: v })} />
    <SliderControl name="noise scale" min={2} max={300} value={p.scale} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ scale: v })} />
    <SliderControl name="octaves" min={1} max={4} value={p.octaves}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ octaves: v })} />
    <SliderControl name="strength" min={0} max={100} value={p.strength} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ strength: v })} />
    <SliderControl name="seed" min={0} max={9999} value={p.seed}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ seed: v })} />
  </>
);
