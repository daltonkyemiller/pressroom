import { IconPlus, IconXmark } from "nucleo-pixel";
import { SegControl, SliderControl } from "@/components/dither/controls";
import { ColorPicker } from "@/components/dither/color-picker";
import type { ControlsComponent } from "../types";
import type { ColorCycleParams } from "./runtime";

export const ColorCycleControls: ControlsComponent<ColorCycleParams> = ({
  params,
  palette,
  onPatch,
}) => {
  const updateColor = (i: number, c: string) => {
    const next = [...params.colors];
    next[i] = c;
    onPatch({ colors: next });
  };
  const removeColor = (i: number) => {
    onPatch({ colors: params.colors.filter((_, idx) => idx !== i) });
  };
  const addColor = () => {
    onPatch({ colors: [...params.colors, palette[0] ?? "#ffffff"] });
  };
  const usePalette = () => {
    onPatch({ colors: [...palette] });
  };
  return (
    <>
      <SegControl name="mode" value={params.mode}
        options={[
          { value: "cycle", label: "cycle" },
          { value: "random", label: "random" },
        ]}
        onChange={(v) => onPatch({ mode: v })} />
      <SegControl name="affect" value={params.affect}
        options={[
          { value: "fill", label: "fill" },
          { value: "stroke", label: "stroke" },
          { value: "both", label: "both" },
        ]}
        onChange={(v) => onPatch({ affect: v })} />
      {params.mode === "random" && (
        <SliderControl name="seed" min={0} max={9999} value={params.seed}
          onChange={(v) => onPatch({ seed: v })} />
      )}
      <div className="mb-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs tracking-wider text-muted-foreground uppercase">colors</span>
          <button
            type="button"
            onClick={usePalette}
            className="text-xs text-muted-foreground hover:text-foreground uppercase tracking-wider"
          >
            use palette
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {params.colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <ColorPicker value={c} onChange={(v) => updateColor(i, v)} />
              <button
                type="button"
                onClick={() => removeColor(i)}
                className="flex size-5 items-center justify-center border border-border hover:border-destructive hover:bg-destructive hover:text-background"
              >
                <IconXmark className="size-2.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addColor}
            className="mt-1 flex items-center justify-center gap-1 border border-dashed border-border px-2 py-1 text-xs tracking-wider uppercase hover:bg-muted"
          >
            <IconPlus className="size-3" /> add color
          </button>
        </div>
      </div>
    </>
  );
};
