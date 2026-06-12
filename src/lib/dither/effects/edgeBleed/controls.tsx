import { SegControl, SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { EdgeBleedParams } from "./runtime";

export const EdgeBleedControls: ControlsComponent<EdgeBleedParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SegControl name="polarity" value={p.polarity}
      options={[
        { value: "spread-dark", label: "ink spread" },
        { value: "spread-light", label: "ink shrink" },
      ]}
      onChange={(v) => onPatch({ polarity: v })} />
    <SliderControl name="amount" min={0} max={30} value={p.amount} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ amount: v })} />
    <SliderControl name="jitter" min={0} max={100} value={p.jitter} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ jitter: v })} />
    <SliderControl name="noise scale" min={1} max={200} value={p.scale} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ scale: v })} />
    <SliderControl name="feather" min={0} max={20} value={p.feather} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ feather: v })} />
    <SliderControl name="strength" min={0} max={100} value={p.strength} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ strength: v })} />
    <SliderControl name="seed" min={0} max={9999} value={p.seed}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ seed: v })} />
  </>
);
