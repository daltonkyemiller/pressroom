import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowDownToLine,
  IconArrowRotateAnticlockwise,
  IconArrowUpFromLine,
  IconImagePlus,
  IconPlus,
} from "nucleo-pixel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { GooFilter } from "@/components/dither/goo-filter";
import { LayerCard } from "@/components/dither/layer-card";
import {
  EFFECT_DEFAULTS,
  EFFECT_DESCRIPTIONS,
  EFFECT_LABELS,
  type EffectKind,
  type Layer,
} from "@/lib/dither/effects";
import { computeWorkDims, exportPNG, renderPipeline } from "@/lib/dither/pipeline";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

// Working resolution for both interactive preview and final commit — keeping
// them identical means scale-sensitive effects (halftone, dither, duotone)
// look the same while scrubbing as they do when released. Export still
// runs at the source's native resolution via renderForExport.
const MAX_DIM = 900;
const EFFECT_KINDS: EffectKind[] = [
  "blur",
  "color",
  "curves",
  "halftone",
  "dither",
  "duotone",
  "invert",
  "noise",
  "grain",
];
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 16;

type Pan = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function makeLayer(kind: EffectKind, id: number, expanded = true): Layer {
  return {
    id,
    kind,
    enabled: true,
    expanded,
    params: structuredClone(EFFECT_DEFAULTS[kind]),
  } as Layer;
}

export default function App() {
  const [layers, setLayers] = useState<Layer[]>(() => {
    return [
      { ...makeLayer("color", 1, true) },
      { ...makeLayer("dither", 2, false) },
    ];
  });
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceName, setSourceName] = useState<string>("sample.gradient");
  const [stageDragHover, setStageDragHover] = useState(false);
  const [statusTime, setStatusTime] = useState("0ms");
  const [statusDim, setStatusDim] = useState("— × —");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(3);
  const rafIdRef = useRef<number | null>(null);
  const pendingRef = useRef(false);
  // ---------- render ----------
  const render = useCallback(
    (original = false) => {
      const canvas = canvasRef.current;
      if (!canvas || !sourceImage) return;
      const t0 = performance.now();
      if (original) {
        const dims = computeWorkDims(sourceImage, MAX_DIM);
        canvas.width = dims.width;
        canvas.height = dims.height;
        const c = canvas.getContext("2d")!;
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = "high";
        c.drawImage(sourceImage, 0, 0, dims.width, dims.height);
        setStatusTime(`0ms · original`);
        setStatusDim(`${dims.width} × ${dims.height}`);
        return;
      }
      const { imgData, width, height } = renderPipeline(sourceImage, layers, MAX_DIM);
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d", { willReadFrequently: true })!.putImageData(imgData, 0, 0);
      const ms = Math.round(performance.now() - t0);
      setStatusTime(`${ms}ms`);
      setStatusDim(`${width} × ${height}`);
    },
    [sourceImage, layers],
  );

  const showOriginalRef = useRef(showOriginal);
  useEffect(() => {
    showOriginalRef.current = showOriginal;
  }, [showOriginal]);

  const scheduleRender = useCallback(() => {
    if (rafIdRef.current !== null) {
      pendingRef.current = true;
      return;
    }
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      render(showOriginalRef.current);
      if (pendingRef.current) {
        pendingRef.current = false;
        scheduleRender();
      }
    });
  }, [render]);

  // ---------- effects: schedule render whenever inputs change ----------
  useEffect(() => {
    scheduleRender();
  }, [sourceImage, layers, showOriginal, scheduleRender]);

  // ---------- track stage size for fit-to-container display ----------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- canvas zoom (wheel, anchored to mouse) ----------
  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      // current zoom captured by closure; use refs for latest values
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = mx / currentZoom;
      const worldY = my / currentZoom;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nextZoom = clamp(currentZoom * factor, ZOOM_MIN, ZOOM_MAX);
      if (nextZoom === currentZoom) return;
      const nextPan = {
        x: currentPan.x + (mx - worldX * nextZoom),
        y: currentPan.y + (my - worldY * nextZoom),
      };
      setZoom(nextZoom);
      setPan(nextPan);
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [sourceImage]);

  // refs to keep zoom/pan handlers up to date without rebinding wheel listener
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const startPan = (e: React.PointerEvent) => {
    if (zoom <= 1 && e.button === 0) {
      // At natural zoom there's nothing to pan, so a hold becomes the
      // before/after comparison: press = original, release = effected.
      e.preventDefault();
      setShowOriginal(true);
      const stop = () => {
        setShowOriginal(false);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
      return;
    }
    e.preventDefault();
    setPanning(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startPanState = { ...pan };
    const onMove = (ev: PointerEvent) => {
      setPan({ x: startPanState.x + (ev.clientX - startX), y: startPanState.y + (ev.clientY - startY) });
    };
    const onUp = () => {
      setPanning(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ---------- sample image on mount ----------
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const cx = c.getContext("2d")!;
    const grad = cx.createRadialGradient(320, 200, 50, 320, 240, 380);
    grad.addColorStop(0, "#ffeac0");
    grad.addColorStop(0.4, "#c89a6e");
    grad.addColorStop(0.8, "#3a2418");
    grad.addColorStop(1, "#0a0604");
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 640, 480);
    cx.fillStyle = "rgba(255,220,180,0.4)";
    cx.beginPath();
    cx.ellipse(320, 200, 130, 170, 0, 0, Math.PI * 2);
    cx.fill();
    cx.fillStyle = "rgba(40,20,10,0.6)";
    cx.beginPath();
    cx.ellipse(320, 380, 200, 80, 0, 0, Math.PI * 2);
    cx.fill();
    cx.fillStyle = "rgba(255,255,255,0.25)";
    cx.beginPath();
    cx.ellipse(280, 170, 40, 50, 0, 0, Math.PI * 2);
    cx.fill();
    const img = new Image();
    img.onload = () => setSourceImage(img);
    img.src = c.toDataURL();
  }, []);

  // ---------- layer ops ----------
  const addLayer = useCallback((kind: EffectKind) => {
    setLayers((ls) => [...ls, makeLayer(kind, nextIdRef.current++)]);
  }, []);

  const removeLayer = useCallback((id: number) => {
    setLayers((ls) => ls.filter((l) => l.id !== id));
  }, []);

  const toggleLayer = useCallback((id: number) => {
    setLayers((ls) =>
      ls.map((l) => (l.id === id ? ({ ...l, enabled: !l.enabled } as Layer) : l)),
    );
  }, []);

  const expandLayer = useCallback((id: number) => {
    setLayers((ls) =>
      ls.map((l) => (l.id === id ? ({ ...l, expanded: !l.expanded } as Layer) : l)),
    );
  }, []);

  const patchLayer = useCallback((id: number, patch: Record<string, unknown>) => {
    setLayers((ls) =>
      ls.map((l) =>
        l.id === id ? ({ ...l, params: { ...l.params, ...patch } } as Layer) : l,
      ),
    );
  }, []);

  const reorderLayer = useCallback((fromId: number, toId: number, edge: Edge) => {
    setLayers((ls) => {
      const fromIdx = ls.findIndex((l) => l.id === fromId);
      if (fromIdx === -1) return ls;
      const next = [...ls];
      const [moved] = next.splice(fromIdx, 1);
      const toIdx = next.findIndex((l) => l.id === toId);
      if (toIdx === -1) {
        next.push(moved);
      } else {
        next.splice(edge === "top" ? toIdx : toIdx + 1, 0, moved);
      }
      return next;
    });
  }, []);

  const resetStack = useCallback(() => {
    if (layers.length === 0) return;
    if (!confirm("Clear all effects?")) return;
    setLayers([makeLayer("color", nextIdRef.current++, true), makeLayer("dither", nextIdRef.current++, false)]);
  }, [layers.length]);

  // ---------- file load ----------
  const loadFile = useCallback((file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setSourceName(file.name);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  // ---------- export ----------
  const onExport = useCallback(async () => {
    if (!sourceImage) return;
    const blob = await exportPNG(sourceImage, layers);
    if (!blob) return;
    const link = document.createElement("a");
    link.download = `dither-stack-${Date.now()}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }, [sourceImage, layers]);

  // ---------- window-level drag/drop ----------
  // Counter handles nested elements emitting their own enter/leave events.
  const dragCounterRef = useRef(0);
  useEffect(() => {
    const hasFile = (e: DragEvent) =>
      e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

    const onEnter = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) setStageDragHover(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFile(e)) return;
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setStageDragHover(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setStageDragHover(false);
      const file = e.dataTransfer?.files[0];
      if (file) loadFile(file);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [loadFile]);

  // ---------- status bar text ----------
  const statusStack = useMemo(() => {
    if (layers.length === 0) return "empty stack";
    return layers.map((l) => (l.enabled ? "" : "·") + EFFECT_LABELS[l.kind].toLowerCase()).join(" → ");
  }, [layers]);

  const activeCount = layers.filter((l) => l.enabled).length;

  const sourceMeta = sourceImage
    ? `${sourceImage.width} × ${sourceImage.height} px · ${sourceName.slice(0, 28)}`
    : "no image loaded";

  // Canvas display dim — fit aspect ratio into available stage space (minus padding).
  const canvasDisplayDims = useMemo(() => {
    if (!sourceImage) return { width: 0, height: 0 };
    const padding = 80; // p-10 on stage + room for labels
    const labelRoom = 40; // top labels
    const availW = Math.max(120, stageSize.w - padding);
    const availH = Math.max(120, stageSize.h - padding - labelRoom);
    if (availW === 0 || availH === 0) return computeWorkDims(sourceImage, MAX_DIM);
    const ratio = sourceImage.width / sourceImage.height;
    let w = availW;
    let h = w / ratio;
    if (h > availH) {
      h = availH;
      w = h * ratio;
    }
    return { width: Math.round(w), height: Math.round(h) };
  }, [sourceImage, stageSize]);

  return (
    <div className="relative grid h-full grid-cols-[320px_1fr] font-sans text-sm">
      <GooFilter />

      {stageDragHover && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 border-2 border-dashed border-foreground bg-background px-8 py-6">
            <IconImagePlus className="size-6" />
            <span className="text-sm tracking-widest uppercase">drop image to load</span>
          </div>
        </div>
      )}

      {/* ===== SIDEBAR ===== */}
      <aside className="flex flex-col border-r border-border bg-background overflow-hidden">
        <div className="flex shrink-0 items-baseline justify-between border-b border-border px-5 py-4">
          <h1 className="font-mondwest text-3xl leading-none tracking-tight">pressroom.</h1>
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            v.02 / stack
          </span>
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            Effect stack
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {layers.length.toString().padStart(2, "0")}
          </span>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-1 px-3.5 pb-2">
            {layers.length === 0 ? (
              <div className="px-3 py-3.5 text-center text-xs text-muted-foreground italic">
                no effects — add one below
              </div>
            ) : (
              layers.map((layer, idx) => (
                <LayerCard
                  key={layer.id}
                  layer={layer}
                  index={idx}
                  onPatch={(patch) => patchLayer(layer.id, patch)}
                  onToggle={() => toggleLayer(layer.id)}
                  onRemove={() => removeLayer(layer.id)}
                  onExpand={() => expandLayer(layer.id)}
                  onInteractStart={() => {}}
                  onInteractEnd={() => {}}
                  onReorder={reorderLayer}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="shrink-0 px-3.5 pt-2.5 pb-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="w-full border border-dashed border-border bg-transparent px-3 py-2.5 text-xs tracking-widest uppercase transition-colors hover:bg-foreground hover:text-background hover:border-solid"
                >
                  + Add effect
                </button>
              }
            />
            <DropdownMenuContent align="start" side="top" className="w-[260px]">
              {EFFECT_KINDS.map((kind) => (
                <DropdownMenuItem
                  key={kind}
                  onClick={() => addLayer(kind)}
                  className="flex items-baseline justify-between"
                >
                  <span className="lowercase">{EFFECT_LABELS[kind].toLowerCase()}</span>
                  <span className="font-mondwest text-sm text-muted-foreground">
                    {EFFECT_DESCRIPTIONS[kind]}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5 border-t border-border px-5 py-3.5 bg-background">
          <Button
            variant="outline"
            size="default"
            className="justify-between text-xs tracking-widest uppercase"
            onClick={() => fileInputRef.current?.click()}
          >
            <span>Upload image</span>
            <IconArrowUpFromLine className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="default"
            className="justify-between text-xs tracking-widest uppercase"
            onClick={resetStack}
          >
            <span>Reset stack</span>
            <IconArrowRotateAnticlockwise className="size-3.5" />
          </Button>
          <Button
            size="default"
            className="justify-between text-xs tracking-widest uppercase"
            onClick={onExport}
            disabled={!sourceImage}
          >
            <span>Export PNG</span>
            <IconArrowDownToLine className="size-3.5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => loadFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <main
        className="relative flex flex-col overflow-hidden"
        style={{
          background:
            "repeating-linear-gradient(0deg,transparent,transparent 19px,oklch(0.145 0 0 / 0.04) 19px,oklch(0.145 0 0 / 0.04) 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,oklch(0.145 0 0 / 0.04) 19px,oklch(0.145 0 0 / 0.04) 20px),var(--background)",
        }}
      >
        <div className="flex h-12 shrink-0 items-center gap-6 border-b border-border bg-background px-5">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            workspace <span className="font-medium text-foreground">/ untitled</span>
          </span>
          <div className="flex-1" />
          <span className="font-mondwest text-base">
            {sourceImage && (
              <span className="mr-2 inline-block size-1.5 rounded-full bg-destructive align-middle [animation:pulse_1.6s_ease-in-out_infinite]" />
            )}
            {sourceMeta}
          </span>
        </div>

        <div
          ref={stageRef}
          className="relative flex flex-1 items-center justify-center overflow-hidden p-10"
        >
          {!sourceImage && (
            <div className="max-w-sm text-center">
              <h2 className="mb-4 font-mondwest text-5xl leading-none tracking-tight">
                Stack <span className="text-destructive">effects</span>
                <br />
                like a darkroom.
              </h2>
              <p className="mx-auto mb-6 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Add layers, drag to reorder, toggle on/off. Order matters — blur before dither
                softens grain; blur after destroys it.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "inline-flex items-center gap-2.5 border border-dashed border-foreground px-5 py-3 text-xs tracking-widest uppercase transition-all",
                  stageDragHover
                    ? "scale-105 bg-foreground text-background"
                    : "hover:bg-foreground hover:text-background",
                )}
              >
                <IconImagePlus className="size-3.5" />
                Drop image or click to upload
              </button>
            </div>
          )}

          {sourceImage && (
            <div
              onPointerDown={startPan}
              onDoubleClick={resetZoom}
              className={cn(
                "relative will-change-transform",
                zoom > 1 ? (panning ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
              )}
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
                width: `${canvasDisplayDims.width}px`,
                height: `${canvasDisplayDims.height}px`,
              }}
            >
              <span className="pointer-events-none absolute -top-5 left-0 text-xs tracking-widest text-muted-foreground uppercase">
                output
              </span>
              <span
                className="pointer-events-none absolute -top-5 text-xs tracking-widest text-muted-foreground uppercase"
                style={{ right: `${-(canvasDisplayDims.width * (zoom - 1))}px` }}
              >
                {showOriginal
                  ? "original"
                  : `${activeCount} active · ${Math.round(zoom * 100)}%`}
              </span>
              <div
                ref={canvasWrapRef}
                className="absolute inset-0 will-change-transform"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "0 0",
                  boxShadow:
                    "0 30px 60px -20px rgba(0,0,0,0.25), 0 0 0 1px var(--foreground)",
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="block"
                  style={{
                    imageRendering: "pixelated",
                    width: `${canvasDisplayDims.width}px`,
                    height: `${canvasDisplayDims.height}px`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex h-8 shrink-0 items-center gap-5 border-t border-border bg-background px-5 text-xs tracking-widest text-muted-foreground uppercase">
          <span className="text-foreground">● ready</span>
          <span className="opacity-40">/</span>
          <span className="text-foreground">{statusStack}</span>
          <span className="opacity-40">/</span>
          <span>{statusDim}</span>
          <span className="opacity-40">/</span>
          <span>{statusTime}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => addLayer("dither")}
            className="text-foreground hover:opacity-60"
            title="quick add dither"
          >
            <IconPlus className="size-3" />
          </button>
        </div>
      </main>
    </div>
  );
}
