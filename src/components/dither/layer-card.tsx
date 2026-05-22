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
import { PaletteControl, SegControl, SliderControl, ToggleControl } from "./controls";

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
          <ToggleControl
            name="serpentine scan"
            value={p.serpentine}
            onChange={(v) => onPatch({ serpentine: v })}
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
