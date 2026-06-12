import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ColorControl,
  SegControl,
  SliderControl,
  ToggleControl,
} from "@/components/dither/controls";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ensureFontLoaded,
  isLocalFontsSupported,
  listFonts,
  loadLocalFonts,
  subscribeFonts,
} from "../../font-registry";
import type { ControlsComponent } from "../types";
import type { TextParams } from "./runtime";

function useFontList() {
  return useSyncExternalStore(subscribeFonts, listFonts, listFonts);
}

export const TextControls: ControlsComponent<TextParams> = ({
  params: p,
  onPatch,
  onStart,
  onCommit,
}) => {
  const fonts = useFontList();
  const supportsLocal = isLocalFontsSupported();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Lazy-load font bytes into the worker when the user picks a font, so
  // OffscreenCanvas inside the pipeline renders with the right glyphs.
  useEffect(() => {
    void ensureFontLoaded(p.font);
  }, [p.font]);

  const onLoadLocal = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const added = await loadLocalFonts();
      setStatus(added === 0 ? "no new fonts" : `+ ${added} fonts`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg.includes("denied") ? "permission denied" : `failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-2">
        <span className="mb-1.5 block text-xs tracking-wider text-muted-foreground uppercase">
          content
        </span>
        <Textarea
          value={p.content}
          onChange={(e) => onPatch({ content: e.target.value })}
          placeholder="type something — newlines start new lines"
          rows={2}
        />
      </div>

      <div className="mb-3">
        <span className="mb-1.5 block text-xs tracking-wider text-muted-foreground uppercase">
          font
        </span>
        <Select value={p.font} onValueChange={(v) => onPatch({ font: v })}>
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
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {supportsLocal ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-[10px]"
              onClick={onLoadLocal}
              disabled={busy}
            >
              {busy ? "loading…" : "use local fonts"}
            </Button>
          ) : (
            <span className="text-[10px] italic text-muted-foreground">
              local fonts api not supported
            </span>
          )}
          {status && <span className="text-[10px] text-muted-foreground">{status}</span>}
        </div>
      </div>

      <SliderControl name="size" min={6} max={1000} value={p.size} unit="px"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ size: v })} />
      <SliderControl name="letter spacing" min={-20} max={80} value={p.letterSpacing} unit="px"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ letterSpacing: v })} />
      <SliderControl name="line height" min={0.5} max={3} step={0.05} value={p.lineHeight} unit="×"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ lineHeight: v })} />
      <SegControl name="align" value={p.align}
        options={[
          { value: "left", label: "left" },
          { value: "center", label: "center" },
          { value: "right", label: "right" },
        ]}
        onChange={(v) => onPatch({ align: v })} />
      <SegControl name="v-align" value={p.vAlign}
        options={[
          { value: "top", label: "top" },
          { value: "middle", label: "middle" },
          { value: "bottom", label: "bottom" },
        ]}
        onChange={(v) => onPatch({ vAlign: v })} />
      <ToggleControl name="bold" value={p.bold} onChange={(v) => onPatch({ bold: v })} />
      <ToggleControl name="italic" value={p.italic} onChange={(v) => onPatch({ italic: v })} />

      <SliderControl name="x" min={-50} max={150} value={p.x} unit="%"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ x: v })} />
      <SliderControl name="y" min={-50} max={150} value={p.y} unit="%"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ y: v })} />
      <SliderControl name="rotation" min={-360} max={360} value={p.rotation} unit="°"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ rotation: v })} />
      <SliderControl name="scale" min={1} max={400} value={p.scale} unit="%"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ scale: v })} />

      <ColorControl name="ink" value={p.color} onChange={(v) => onPatch({ color: v })} />
      <SliderControl name="opacity" min={0} max={1} step={0.05} value={p.opacity}
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ opacity: v })} />

      <SliderControl name="blur" min={0} max={30} value={p.blur} unit="px"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ blur: v })} />
      <SliderControl name="dilate (ink spread)" min={0} max={20} value={p.dilate} unit="px"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ dilate: v })} />
      <SliderControl name="displace" min={0} max={30} value={p.displace} unit="px"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ displace: v })} />
      <SliderControl name="displace scale" min={1} max={80} value={p.displaceScale} unit="px"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ displaceScale: v })} />
      <SliderControl name="dust" min={0} max={100} value={p.dust} unit="%"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ dust: v })} />
      <SliderControl name="dust scale" min={1} max={60} value={p.dustScale} unit="px"
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ dustScale: v })} />
      <SliderControl name="threshold" min={0} max={255} value={p.threshold}
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ threshold: v })} />
      <SliderControl name="threshold softness" min={0} max={1} step={0.02} value={p.thresholdSoftness}
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ thresholdSoftness: v })} />
      <SliderControl name="seed" min={0} max={9999} value={p.seed}
        onStart={onStart} onCommit={onCommit} onChange={(v) => onPatch({ seed: v })} />
    </>
  );
};
