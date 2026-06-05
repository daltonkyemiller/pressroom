import { type CSSProperties, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  IconChevronRight,
  IconCopy,
  IconEye,
  IconEyeSlash,
  IconGripDotsVertical,
  IconXmark,
} from "nucleo-pixel";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { cn } from "@/lib/utils";
import { EFFECT_LABELS, summarizeLayer, type Layer } from "@/lib/dither/effects";
import {
  ensureFontLoaded,
  isLocalFontsSupported,
  listFonts,
  loadLocalFonts,
  subscribeFonts,
} from "@/lib/dither/font-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  onDuplicate: () => void;
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
  onDuplicate,
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
        // Native drag image defaults to a snapshot of `element`, which here
        // is the whole card INCLUDING the expanded params body. With params
        // open the ghost balloons to several hundred pixels and floats off
        // from the cursor. Replace it with a compact pill carrying just
        // the layer's label.
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({ x: "12px", y: "8px" }),
            render: ({ container }) => {
              const el = document.createElement("div");
              el.style.cssText = [
                "padding: 6px 10px",
                "background: var(--background)",
                "color: var(--foreground)",
                "border: 1px solid var(--foreground)",
                "font-family: inherit",
                "font-size: 12px",
                "letter-spacing: 0.05em",
                "text-transform: uppercase",
                "white-space: nowrap",
                "box-shadow: 0 4px 12px rgba(0,0,0,0.25)",
              ].join(";");
              el.textContent = EFFECT_LABELS[layer.kind];
              container.appendChild(el);
              return () => {};
            },
          });
        },
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
  }, [layer.id, layer.kind, onReorder]);

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
          onClick={onDuplicate}
          title="duplicate"
          className="flex size-6 shrink-0 items-center justify-center border border-border hover:border-foreground/60 hover:bg-muted"
        >
          <IconCopy className="size-3" />
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
    case "progressiveBlur": {
      const p = layer.params;
      return (
        <>
          <SegControl
            name="direction"
            value={p.direction}
            options={[
              { value: "linear", label: "linear" },
              { value: "radial", label: "radial" },
            ]}
            onChange={(v) => onPatch({ direction: v })}
          />
          <SliderControl
            name="max radius"
            min={0}
            max={40}
            value={p.maxRadius}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ maxRadius: v })}
          />
          <SliderControl
            name="start"
            min={0}
            max={100}
            value={p.start}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ start: v })}
          />
          <SliderControl
            name="end"
            min={0}
            max={100}
            value={p.end}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ end: v })}
          />
          <SliderControl
            name="curve"
            min={0.3}
            max={3}
            step={0.05}
            value={p.curve}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ curve: v })}
          />
          {p.direction === "linear" ? (
            <SliderControl
              name="angle"
              min={0}
              max={360}
              value={p.angle}
              unit="°"
              onStart={onStart}
              onCommit={onCommit}
              onChange={(v) => onPatch({ angle: v })}
            />
          ) : (
            <>
              <SliderControl
                name="center x"
                min={0}
                max={100}
                value={p.centerX}
                unit="%"
                onStart={onStart}
                onCommit={onCommit}
                onChange={(v) => onPatch({ centerX: v })}
              />
              <SliderControl
                name="center y"
                min={0}
                max={100}
                value={p.centerY}
                unit="%"
                onStart={onStart}
                onCommit={onCommit}
                onChange={(v) => onPatch({ centerY: v })}
              />
            </>
          )}
          <ToggleControl
            name="invert"
            value={p.invert}
            onChange={(v) => onPatch({ invert: v })}
          />
        </>
      );
    }
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
          <SliderControl
            name="temperature"
            min={-100}
            max={100}
            value={p.temperature}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ temperature: v })}
          />
          <SliderControl
            name="tint"
            min={-100}
            max={100}
            value={p.tint}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ tint: v })}
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
            min={1}
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
            name="preserve transparency"
            value={p.preserveTransparency}
            onChange={(v) => onPatch({ preserveTransparency: v })}
          />
          <ToggleControl
            name="preserve colors"
            value={p.preserveColors}
            onChange={(v) => onPatch({ preserveColors: v })}
          />
          {p.preserveColors && (
            <ColorControl
              name="ink color"
              value={p.inkColor}
              onChange={(v) => onPatch({ inkColor: v })}
            />
          )}
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
    case "displace": {
      const p = layer.params;
      return (
        <>
          <SliderControl
            name="amount"
            min={0}
            max={80}
            value={p.amount}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ amount: v })}
          />
          <SliderControl
            name="noise scale"
            min={2}
            max={300}
            value={p.scale}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ scale: v })}
          />
          <SliderControl
            name="octaves"
            min={1}
            max={4}
            value={p.octaves}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ octaves: v })}
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
    case "chromatic": {
      const p = layer.params;
      return (
        <>
          <SegControl
            name="mode"
            value={p.mode}
            options={[
              { value: "linear", label: "linear" },
              { value: "radial", label: "radial" },
            ]}
            onChange={(v) => onPatch({ mode: v })}
          />
          <SliderControl
            name="amount"
            min={0}
            max={40}
            value={p.amount}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ amount: v })}
          />
          {p.mode === "linear" && (
            <SliderControl
              name="angle"
              min={0}
              max={360}
              value={p.angle}
              unit="°"
              onStart={onStart}
              onCommit={onCommit}
              onChange={(v) => onPatch({ angle: v })}
            />
          )}
        </>
      );
    }
    case "edgeBleed": {
      const p = layer.params;
      return (
        <>
          <SegControl
            name="polarity"
            value={p.polarity}
            options={[
              { value: "spread-dark", label: "ink spread" },
              { value: "spread-light", label: "ink shrink" },
            ]}
            onChange={(v) => onPatch({ polarity: v })}
          />
          <SliderControl
            name="amount"
            min={0}
            max={30}
            value={p.amount}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ amount: v })}
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
          <SliderControl
            name="noise scale"
            min={1}
            max={200}
            value={p.scale}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ scale: v })}
          />
          <SliderControl
            name="feather"
            min={0}
            max={20}
            value={p.feather}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ feather: v })}
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
    case "text":
      return <TextLayerControls layer={layer} onPatch={onPatch} onStart={onStart} onCommit={onCommit} />;
    case "stipple": {
      const p = layer.params;
      return (
        <>
          <SliderControl
            name="density"
            min={2}
            max={50}
            value={p.density}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ density: v })}
          />
          <SliderControl
            name="min size"
            min={0}
            max={20}
            step={0.1}
            value={p.minSize}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ minSize: v })}
          />
          <SliderControl
            name="max size"
            min={0}
            max={30}
            step={0.1}
            value={p.maxSize}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ maxSize: v })}
          />
          <SliderControl
            name="threshold"
            min={0}
            max={100}
            value={p.threshold}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ threshold: v })}
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
          <SliderControl
            name="seed"
            min={0}
            max={9999}
            value={p.seed}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ seed: v })}
          />
          <ColorControl
            name="ink"
            value={p.inkColor}
            onChange={(v) => onPatch({ inkColor: v })}
          />
          <ToggleControl
            name="paper background"
            value={p.bgEnabled}
            onChange={(v) => onPatch({ bgEnabled: v })}
          />
          {p.bgEnabled && (
            <ColorControl
              name="paper"
              value={p.bgColor}
              onChange={(v) => onPatch({ bgColor: v })}
            />
          )}
          <ToggleControl
            name="preserve colors"
            value={p.preserveColors}
            onChange={(v) => onPatch({ preserveColors: v })}
          />
        </>
      );
    }
    case "riso": {
      const p = layer.params;
      return (
        <>
          <ColorControl
            name="paper"
            value={p.paperColor}
            onChange={(v) => onPatch({ paperColor: v })}
          />
          <ColorControl
            name="ink 1"
            value={p.ink1Color}
            onChange={(v) => onPatch({ ink1Color: v })}
          />
          <SliderControl
            name="ink 1 threshold"
            min={0}
            max={100}
            value={p.threshold1}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ threshold1: v })}
          />
          <SliderControl
            name="ink 1 offset"
            min={0}
            max={20}
            step={0.5}
            value={p.offset1}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ offset1: v })}
          />
          <SliderControl
            name="ink 1 angle"
            min={0}
            max={360}
            value={p.angle1}
            unit="°"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ angle1: v })}
          />
          <SliderControl
            name="ink 1 grain"
            min={0}
            max={100}
            value={p.grain1}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ grain1: v })}
          />
          <ColorControl
            name="ink 2"
            value={p.ink2Color}
            onChange={(v) => onPatch({ ink2Color: v })}
          />
          <SliderControl
            name="ink 2 threshold"
            min={0}
            max={100}
            value={p.threshold2}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ threshold2: v })}
          />
          <SliderControl
            name="ink 2 offset"
            min={0}
            max={20}
            step={0.5}
            value={p.offset2}
            unit="px"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ offset2: v })}
          />
          <SliderControl
            name="ink 2 angle"
            min={0}
            max={360}
            value={p.angle2}
            unit="°"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ angle2: v })}
          />
          <SliderControl
            name="ink 2 grain"
            min={0}
            max={100}
            value={p.grain2}
            unit="%"
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ grain2: v })}
          />
          <SliderControl
            name="softness"
            min={0}
            max={1}
            step={0.02}
            value={p.softness}
            onStart={onStart}
            onCommit={onCommit}
            onChange={(v) => onPatch({ softness: v })}
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

type TextLayerControlsProps = {
  layer: Extract<Layer, { kind: "text" }>;
  onPatch: (patch: Record<string, unknown>) => void;
  onStart: () => void;
  onCommit: () => void;
};

function useFontList() {
  return useSyncExternalStore(subscribeFonts, listFonts, listFonts);
}

function TextLayerControls({ layer, onPatch, onStart, onCommit }: TextLayerControlsProps) {
  const p = layer.params;
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
        <Input
          value={p.content}
          onChange={(e) => onPatch({ content: e.target.value })}
          placeholder="type something"
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

      <SliderControl
        name="size"
        min={6}
        max={1000}
        value={p.size}
        unit="px"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ size: v })}
      />
      <SliderControl
        name="letter spacing"
        min={-20}
        max={80}
        value={p.letterSpacing}
        unit="px"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ letterSpacing: v })}
      />
      <SegControl
        name="align"
        value={p.align}
        options={[
          { value: "left", label: "left" },
          { value: "center", label: "center" },
          { value: "right", label: "right" },
        ]}
        onChange={(v) => onPatch({ align: v })}
      />
      <ToggleControl name="bold" value={p.bold} onChange={(v) => onPatch({ bold: v })} />
      <ToggleControl
        name="italic"
        value={p.italic}
        onChange={(v) => onPatch({ italic: v })}
      />

      <SliderControl
        name="x"
        min={-50}
        max={150}
        value={p.x}
        unit="%"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ x: v })}
      />
      <SliderControl
        name="y"
        min={-50}
        max={150}
        value={p.y}
        unit="%"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ y: v })}
      />
      <SliderControl
        name="rotation"
        min={-360}
        max={360}
        value={p.rotation}
        unit="°"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ rotation: v })}
      />
      <SliderControl
        name="scale"
        min={1}
        max={400}
        value={p.scale}
        unit="%"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ scale: v })}
      />

      <ColorControl name="ink" value={p.color} onChange={(v) => onPatch({ color: v })} />
      <SliderControl
        name="opacity"
        min={0}
        max={1}
        step={0.05}
        value={p.opacity}
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ opacity: v })}
      />

      <SliderControl
        name="blur"
        min={0}
        max={30}
        value={p.blur}
        unit="px"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ blur: v })}
      />
      <SliderControl
        name="dilate (ink spread)"
        min={0}
        max={20}
        value={p.dilate}
        unit="px"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ dilate: v })}
      />
      <SliderControl
        name="displace"
        min={0}
        max={30}
        value={p.displace}
        unit="px"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ displace: v })}
      />
      <SliderControl
        name="displace scale"
        min={1}
        max={80}
        value={p.displaceScale}
        unit="px"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ displaceScale: v })}
      />
      <SliderControl
        name="dust"
        min={0}
        max={100}
        value={p.dust}
        unit="%"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ dust: v })}
      />
      <SliderControl
        name="dust scale"
        min={1}
        max={60}
        value={p.dustScale}
        unit="px"
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ dustScale: v })}
      />
      <SliderControl
        name="threshold"
        min={0}
        max={255}
        value={p.threshold}
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ threshold: v })}
      />
      <SliderControl
        name="threshold softness"
        min={0}
        max={1}
        step={0.02}
        value={p.thresholdSoftness}
        onStart={onStart}
        onCommit={onCommit}
        onChange={(v) => onPatch({ thresholdSoftness: v })}
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
