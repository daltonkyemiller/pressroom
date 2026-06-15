import { ColorControl, SegControl, SliderControl } from "@/components/dither/controls";
import type { ControlsComponent } from "../types";
import type { GrainParams } from "../../grain";

export const GrainControls: ControlsComponent<GrainParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => (
  <>
    <SliderControl name="amount" min={0} max={100} value={p.amount}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ amount: v })} />
    <SliderControl name="size" min={0.1} max={6} step={0.05} value={p.size} unit="px"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ size: v })} />
    <SliderControl name="roughness" min={0} max={100} value={p.roughness} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ roughness: v })} />
    <SliderControl name="aspect" min={-100} max={100} value={p.aspect}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ aspect: v })} />
    <SliderControl name="shadows" min={0} max={200} value={p.shadows} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ shadows: v })} />
    <SliderControl name="highlights" min={0} max={200} value={p.highlights} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ highlights: v })} />
    <SliderControl name="falloff" min={0.3} max={3} step={0.05} value={p.falloff}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ falloff: v })} />
    <SliderControl name="color amount" min={0} max={100} value={p.colorAmount} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ colorAmount: v })} />
    <SliderControl name="tint strength" min={0} max={100} value={p.tintStrength} unit="%"
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ tintStrength: v })} />
    <ColorControl name="tint color" value={p.tintColor}
      onChange={(v) => onPatch({ tintColor: v })} />
    <SegControl name="blend" value={p.blend}
      options={[
        { value: "add", label: "add" },
        { value: "multiply", label: "multiply" },
        { value: "screen", label: "screen" },
      ]}
      onChange={(v) => onPatch({ blend: v })} />
    <SliderControl name="seed" min={0} max={9999} value={p.seed}
      onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ seed: v })} />
  </>
);
