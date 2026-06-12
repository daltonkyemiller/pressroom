import { useEffect, useSyncExternalStore } from "react";
import { SegControl, SliderControl } from "@/components/dither/controls";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ensureFontLoaded, listFonts, subscribeFonts } from "../../font-registry";
import type { ControlsComponent } from "../types";
import type { TextParams } from "./runtime";

function useFontList() {
  return useSyncExternalStore(
    subscribeFonts,
    () => listFonts(),
    () => listFonts(),
  );
}

export const TextControls: ControlsComponent<TextParams> = ({ params, onPatch }) => {
  const fonts = useFontList();
  // Lazy-load font bytes when the user picks a font (so booleans + display
  // both work for local fonts).
  useEffect(() => {
    void ensureFontLoaded(params.font);
  }, [params.font]);
  return (
    <>
      <div className="mb-2">
        <span className="mb-1.5 block text-xs tracking-wider text-muted-foreground uppercase">
          content
        </span>
        <Input
          value={params.content}
          onChange={(e) => onPatch({ content: e.target.value })}
        />
      </div>
      <div className="mb-3">
        <span className="mb-1.5 block text-xs tracking-wider text-muted-foreground uppercase">
          font
        </span>
        <Select value={params.font} onValueChange={(v) => onPatch({ font: v })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="pick a font" />
          </SelectTrigger>
          <SelectContent>
            {fonts.map((f) => (
              <SelectItem key={f.family} value={f.family}>
                <span style={{ fontFamily: `"${f.family}", system-ui` }}>{f.family}</span>
                {f.source === "local" && (
                  <span className="ml-2 text-[10px] text-muted-foreground">local</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SliderControl name="size" min={6} max={800} value={params.size} unit="px"
        onChange={(v) => onPatch({ size: v })} />
      <SliderControl name="letter spacing" min={-20} max={60} value={params.letterSpacing}
        onChange={(v) => onPatch({ letterSpacing: v })} />
      <SegControl name="anchor" value={params.anchor}
        options={[
          { value: "start", label: "start" },
          { value: "middle", label: "middle" },
          { value: "end", label: "end" },
        ]}
        onChange={(v) => onPatch({ anchor: v })} />
      <SegControl name="baseline" value={params.baseline}
        options={[
          { value: "hanging", label: "top" },
          { value: "middle", label: "middle" },
          { value: "alphabetic", label: "base" },
        ]}
        onChange={(v) => onPatch({ baseline: v })} />
      <SliderControl name="center x" min={-2000} max={2000} value={params.cx}
        onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="center y" min={-2000} max={2000} value={params.cy}
        onChange={(v) => onPatch({ cy: v })} />
      <SliderControl name="rotation" min={0} max={360} value={params.rotation} unit="°"
        onChange={(v) => onPatch({ rotation: v })} />
    </>
  );
};
