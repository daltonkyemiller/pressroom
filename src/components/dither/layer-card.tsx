import { type CSSProperties, useEffect, useRef, useState } from "react";
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
import { controlsFor } from "@/lib/dither/effects/controls-registry";

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
          <LayerBody
            layer={layer}
            onPatch={onPatch}
            onStart={onInteractStart}
            onCommit={onInteractEnd}
          />
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
  // The registry replaces the 16-arm switch. Per-kind controls live next
  // to their runtime in `src/lib/dither/effects/<kind>/controls.tsx`.
  // The `as never` cast bridges TS's correlated-union limitation —
  // standard pattern when looking up by discriminator across a generic
  // registry.
  const Controls = controlsFor(layer.kind);
  return (
    <Controls
      params={layer.params as never}
      onPatch={onPatch}
      onStart={onStart}
      onCommit={onCommit}
    />
  );
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
