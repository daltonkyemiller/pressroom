import { useRef, useState } from "react";
import { SliderControl } from "@/components/dither/controls";
import { Button } from "@/components/ui/button";
import { LinkedSliders } from "@/components/forge/linked-sliders";
import type { ControlsComponent } from "../types";
import { parseSvgContent, type SvgParams } from "./runtime";

// Pick a width/height for a freshly-loaded SVG that preserves its source
// aspect ratio. We use the current `currentLongest` value (whichever of
// width/height was bigger) as the longest dim of the new fit — so the
// SVG occupies roughly the same canvas space the previous content did,
// just at the right shape.
function fitToAspect(
  svg: string,
  currentLongest: number,
): { width: number; height: number } | null {
  const { viewBox } = parseSvgContent(svg);
  const [, , vw, vh] = viewBox;
  if (!Number.isFinite(vw) || !Number.isFinite(vh) || vw <= 0 || vh <= 0) {
    return null;
  }
  const aspect = vw / vh;
  if (aspect >= 1) {
    return { width: currentLongest, height: Math.round(currentLongest / aspect) };
  }
  return { width: Math.round(currentLongest * aspect), height: currentLongest };
}

export const SvgControls: ControlsComponent<SvgParams> = ({ params, onPatch }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!/svg/i.test(file.type) && !file.name.toLowerCase().endsWith(".svg")) {
      setStatus("not an svg file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!text) return;
      // Honor the source SVG's aspect ratio so a wide/tall asset isn't
      // squashed into the previous square. We pin the longest dim to
      // the existing one so the canvas footprint stays familiar.
      const longest = Math.max(params.width, params.height) || 300;
      const fit = fitToAspect(text, longest);
      if (fit) {
        onPatch({ content: text, width: fit.width, height: fit.height });
      } else {
        onPatch({ content: text });
      }
      setStatus(`loaded ${file.name}`);
    };
    reader.onerror = () => setStatus("failed to read file");
    reader.readAsText(file);
  };

  const fitToContent = () => {
    const longest = Math.max(params.width, params.height) || 300;
    const fit = fitToAspect(params.content, longest);
    if (fit) {
      onPatch({ width: fit.width, height: fit.height });
      setStatus("fit to content");
    } else {
      setStatus("couldn't read viewBox");
    }
  };

  return (
    <>
      <div className="mb-2 flex gap-1">
        <Button variant="outline" size="sm" className="flex-1"
          onClick={() => fileRef.current?.click()}>
          load svg…
        </Button>
        <Button variant="outline" size="sm" className="flex-1"
          onClick={fitToContent}
          title="resize width/height to match the SVG's viewBox aspect ratio">
          fit to content
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".svg,image/svg+xml"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {status && <p className="mb-2 text-[11px] text-muted-foreground">{status}</p>}
      <div className="mb-2">
        <span className="mb-1.5 block text-xs tracking-wider text-muted-foreground uppercase">
          svg markup
        </span>
        <textarea
          value={params.content}
          onChange={(e) => onPatch({ content: e.target.value })}
          className="border-input bg-muted/30 focus-visible:border-ring focus-visible:ring-ring/50 h-24 w-full resize-y rounded-none border p-2 font-mono text-[11px] outline-none focus-visible:ring-1"
          spellCheck={false}
          placeholder="<svg viewBox='0 0 100 100'>…</svg>"
        />
      </div>
      <SliderControl name="center x" min={-2000} max={2000} value={params.cx}
        onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="center y" min={-2000} max={2000} value={params.cy}
        onChange={(v) => onPatch({ cy: v })} />
      <LinkedSliders aName="width" bName="height" aValue={params.width} bValue={params.height}
        min={0} max={4000} defaultLinked
        onChange={(width, height) => onPatch({ width, height })} />
    </>
  );
};
