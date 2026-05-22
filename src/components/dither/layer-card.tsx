import { type CSSProperties, useEffect, useRef, useState } from "react";
import { IconChevronRight, IconEye, IconEyeSlash, IconGripDotsVertical, IconXmark } from "nucleo-pixel";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { cn } from "@/lib/utils";
import { EFFECT_LABELS, summarizeLayer, type Layer } from "@/lib/dither/effects";
import {
  ColorControl,
  PaletteControl,
  SegControl,
  SliderControl,
  ToggleControl,
} from "./controls";
import { CurvesEditor } from "./curves-editor";
import type { CurvesParams } from "@/lib/dither/curves";

type LayerCardProps = {
  layer: Layer;
  index: number;
  onPatch: (params: Record<string, unknown>) => void;
  onToggle: () => void;
  onRemove: () => void;
  onExpand: () => void;
  onInteractStart: () => void;
  onInteractEnd: () => void;
  onReorder: (fromId: number, toId: number, edge: Edge) => void;
};

const LAYER_DRAG_TYPE = "pressroom-layer";

export function LayerCard({
  layer,
  index,
  onPatch,
  onToggle,
  onRemove,
  onExpand,
  onInteractStart,
  onInteractEnd,
  onReorder,
}: LayerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLSpanElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const card = cardRef.current;
    const grip = gripRef.current;
    if (!card || !grip) return;
    return combine(
      draggable({
        element: card,
        dragHandle: grip,
        getInitialData: () => ({ type: LAYER_DRAG_TYPE, id: layer.id }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: card,
        canDrop: ({ source }) =>
          source.data.type === LAYER_DRAG_TYPE && source.data.id !== layer.id,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { type: LAYER_DRAG_TYPE, id: layer.id },
            { input, element, allowedEdges: ["top", "bottom"] },
          ),
        getIsSticky: () => true,
        onDrag: ({ self, source }) => {
          if (source.data.id === layer.id) {
            setClosestEdge(null);
            return;
          }
          setClosestEdge(extractClosestEdge(self.data));
        },
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ self, source }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          const fromId = source.data.id;
          if (typeof fromId === "number" && fromId !== layer.id) {
            onReorder(fromId, layer.id, edge);
          }
        },
      }),
    );
  }, [layer.id, onReorder]);

  return (
    <div
      ref={cardRef}
      data-layer-id={layer.id}
      className={cn(
        "relative border border-border bg-background select-none transition-opacity",
        isDragging && "opacity-40",
        !layer.enabled && "[&_[data-layer-meta]]:opacity-35",
      )}
    >
      {closestEdge === "top" && <DropIndicator position="top" />}
      {closestEdge === "bottom" && <DropIndicator position="bottom" />}
      <div
        className="flex cursor-pointer items-center gap-2 px-2.5 py-2"
        onClick={(e) => {
          if (
            (e.target as HTMLElement).closest("[data-layer-action]") ||
            (e.target as HTMLElement).closest("[data-layer-grip]")
          )
            return;
          onExpand();
        }}
      >
        <span
          ref={gripRef}
          data-layer-grip
          className="text-muted-foreground flex shrink-0 cursor-grab opacity-40 hover:opacity-100 active:cursor-grabbing"
          title="drag to reorder"
        >
          <IconGripDotsVertical className="size-3.5" />
        </span>
        <IconChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            layer.expanded && "rotate-90 text-foreground",
          )}
        />
        <span className="w-5 shrink-0 text-sm text-muted-foreground tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span data-layer-meta className="min-w-0 flex-1 leading-tight">
          <span className="block text-xs tracking-widest text-muted-foreground uppercase">
            {EFFECT_LABELS[layer.kind]}
          </span>
          <span className="block truncate text-sm">{summarizeLayer(layer)}</span>
        </span>
        <button
          type="button"
          data-layer-action
          onClick={onToggle}
          title="toggle visibility"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center border border-border transition-colors",
            layer.enabled ? "bg-foreground text-background" : "bg-transparent hover:bg-muted",
          )}
        >
          {layer.enabled ? <IconEye className="size-3" /> : <IconEyeSlash className="size-3" />}
        </button>
        <button
          type="button"
          data-layer-action
          onClick={onRemove}
          title="remove"
          className="flex size-6 shrink-0 items-center justify-center border border-border hover:border-destructive hover:bg-destructive hover:text-background"
        >
          <IconXmark className="size-3" />
        </button>
      </div>

      {layer.expanded && (
        <div className="border-t border-border/40 bg-muted/20 px-3 py-3">
          <LayerBody layer={layer} onPatch={onPatch} onStart={onInteractStart} onCommit={onInteractEnd} />
        </div>
      )}
    </div>
  );
}

function LayerBody({
  layer,
  onPatch,
  onStart,
  onCommit,
}: {
  layer: Layer;
  onPatch: (params: Record<string, unknown>) => void;
  onStart: () => void;
  onCommit: () => void;
}) {
  switch (layer.kind) {
    case "blur":
      return (
        <SliderControl
          name="radius"
          min={0}
          max={20}
          value={layer.params.radius}
          onStart={onStart}
          onCommit={onCommit}
          onChange={(v) => onPatch({ radius: v })}
        />
      );
    case "color": {
      const p = layer.params;
      return (
        <>
          <SliderControl
            name="contrast"
            min={-100}
            max={100}
            value={p.contrast}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ contrast: v })}
          />
          <SliderControl
            name="brightness"
            min={-100}
            max={100}
            value={p.brightness}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ brightness: v })}
          />
          <SliderControl
            name="midtones"
            min={0.3}
            max={3}
            step={0.05}
            value={p.gamma}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ gamma: v })}
          />
          <SliderControl
            name="saturation"
            min={0}
            max={200}
            value={p.saturation}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ saturation: v })}
          />
        </>
      );
    }
    case "curves":
      return (
        <CurvesEditor
          value={layer.params}
          onChange={(next: CurvesParams) =>
            onPatch(next as unknown as Record<string, unknown>)
          }
          onInteractStart={onStart}
          onInteractEnd={onCommit}
        />
      );
    case "halftone": {
      const p = layer.params;
      return (
        <>
          <SliderControl
            name="cell size"
            min={3}
            max={24}
            value={p.size}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ size: v })}
          />
          <SliderControl
            name="angle"
            min={0}
            max={90}
            value={p.angle}
            unit="°"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ angle: v })}
          />
          <SliderControl
            name="dot spread"
            min={50}
            max={180}
            step={5}
            value={p.spread}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ spread: v })}
          />
          <SliderControl
            name="gooeyness"
            min={0}
            max={30}
            value={p.goo}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ goo: v })}
          />
          <SegControl
            name="shape"
            value={p.shape}
            options={[
              { value: "dot", label: "dot" },
              { value: "line", label: "line" },
              { value: "cross", label: "cross" },
              { value: "square", label: "square" },
            ]}
            onChange={(v) => onPatch({ shape: v })}
          />
          <PaletteControl
            name="palette"
            value={p.palette}
            onChange={(v) => onPatch({ palette: v })}
          />
          <ToggleControl
            name="preserve colors"
            value={p.preserveColors}
            onChange={(v) => onPatch({ preserveColors: v })}
          />
        </>
      );
    }
    case "dither": {
      const p = layer.params;
      return (
        <>
          <SegControl
            name="algorithm"
            cols={2}
            value={p.algo}
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
            onChange={(v) => onPatch({ algo: v })}
          />
          <PaletteControl
            name="palette"
            value={p.palette}
            onChange={(v) => onPatch({ palette: v })}
          />
          <SliderControl
            name="strength"
            min={0}
            max={100}
            value={p.strength}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ strength: v })}
          />
          <SliderControl
            name="pre-blur"
            min={0}
            max={5}
            value={p.preBlur}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ preBlur: v })}
          />
          <SliderControl
            name="diffusion"
            min={0}
            max={200}
            value={p.diffusion}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ diffusion: v })}
          />
          <SliderControl
            name="matrix scale"
            min={16}
            max={128}
            value={p.matrixScale}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ matrixScale: v })}
          />
          <SliderControl
            name="jitter"
            min={0}
            max={100}
            value={p.jitter}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ jitter: v })}
          />
          <ToggleControl
            name="serpentine scan"
            value={p.serpentine}
            onChange={(v) => onPatch({ serpentine: v })}
          />
          <ToggleControl
            name="preserve colors"
            value={p.preserveColors}
            onChange={(v) => onPatch({ preserveColors: v })}
          />
        </>
      );
    }
    case "invert":
      return <div className="font-mondwest text-base text-muted-foreground">no parameters</div>;
    case "noise":
      return (
        <SliderControl
          name="amount"
          min={0}
          max={100}
          value={layer.params.amount}
          onStart={onStart}
          onCommit={onCommit}
          onChange={(v) => onPatch({ amount: v })}
        />
      );
    case "grain": {
      const p = layer.params;
      return (
        <>
          <SliderControl
            name="amount"
            min={0}
            max={100}
            value={p.amount}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ amount: v })}
          />
          <SliderControl
            name="size"
            min={0.5}
            max={6}
            step={0.1}
            value={p.size}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ size: v })}
          />
          <SliderControl
            name="roughness"
            min={0}
            max={100}
            value={p.roughness}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ roughness: v })}
          />
          <SliderControl
            name="aspect"
            min={-100}
            max={100}
            value={p.aspect}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ aspect: v })}
          />
          <SliderControl
            name="shadows"
            min={0}
            max={200}
            value={p.shadows}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ shadows: v })}
          />
          <SliderControl
            name="highlights"
            min={0}
            max={200}
            value={p.highlights}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ highlights: v })}
          />
          <SliderControl
            name="falloff"
            min={0.3}
            max={3}
            step={0.05}
            value={p.falloff}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ falloff: v })}
          />
          <SliderControl
            name="color amount"
            min={0}
            max={100}
            value={p.colorAmount}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ colorAmount: v })}
          />
          <SliderControl
            name="tint strength"
            min={0}
            max={100}
            value={p.tintStrength}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ tintStrength: v })}
          />
          <ColorControl
            name="tint color"
            value={p.tintColor}
            onChange={(v) => onPatch({ tintColor: v })}
          />
          <SegControl
            name="blend"
            value={p.blend}
            options={[
              { value: "add", label: "add" },
              { value: "multiply", label: "multiply" },
              { value: "screen", label: "screen" },
            ]}
            onChange={(v) => onPatch({ blend: v })}
          />
          <SliderControl
            name="seed"
            min={0}
            max={9999}
            value={p.seed}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ seed: v })}
          />
        </>
      );
    }
    case "duotone": {
      const p = layer.params;
      return (
        <>
          <SliderControl
            name="cell size"
            min={2}
            max={48}
            value={p.tile}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ tile: v })}
          />
          <SliderControl
            name="length"
            min={0}
            max={2}
            step={0.05}
            value={p.lengthScale}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ lengthScale: v })}
          />
          <SliderControl
            name="thickness"
            min={0.02}
            max={1}
            step={0.02}
            value={p.thickness}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ thickness: v })}
          />
          <SliderControl
            name="brightness offset"
            min={-0.5}
            max={0.5}
            step={0.02}
            value={p.brightnessOffset}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ brightnessOffset: v })}
          />
          <SliderControl
            name="contrast"
            min={0.5}
            max={3}
            step={0.05}
            value={p.contrast}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ contrast: v })}
          />
          <SliderControl
            name="blur radius"
            min={0}
            max={20}
            value={p.blurRadius}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ blurRadius: v })}
          />
          <SliderControl
            name="blur passes"
            min={0}
            max={3}
            value={p.blurPasses}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ blurPasses: v })}
          />
          <SliderControl
            name="gradient align"
            min={0}
            max={1}
            step={0.05}
            value={p.gradientAlign}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ gradientAlign: v })}
          />
          <SliderControl
            name="back opacity"
            min={0}
            max={1}
            step={0.05}
            value={p.backOpacity}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ backOpacity: v })}
          />
          <ColorControl
            name="dash color"
            value={p.dashColor}
            onChange={(v) => onPatch({ dashColor: v })}
          />
          <ColorControl
            name="back color"
            value={p.backColor}
            onChange={(v) => onPatch({ backColor: v })}
          />
          <ToggleControl
            name="original colors"
            value={p.originalColors}
            onChange={(v) => onPatch({ originalColors: v })}
          />
          <ToggleControl
            name="inverted"
            value={p.inverted}
            onChange={(v) => onPatch({ inverted: v })}
          />
        </>
      );
    }
  }
}

function DropIndicator({ position }: { position: "top" | "bottom" }) {
  const style: CSSProperties = position === "top" ? { top: -1 } : { bottom: -1 };
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
      style={style}
    />
  );
}
