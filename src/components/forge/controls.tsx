import { useRef, useState } from "react";
import { IconLink, IconLinkBroken, IconPlus, IconXmark } from "nucleo-pixel";
import {
  ColorControl,
  SegControl,
  SliderControl,
  ToggleControl,
} from "@/components/dither/controls";
import { ColorPicker } from "@/components/dither/color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  BarStackParams,
  BooleanParams,
  ClipParams,
  ColorCycleParams,
  EllipseParams,
  GrainParams,
  GridRepeatParams,
  LinearRepeatParams,
  MirrorParams,
  Modifier,
  Node as ForgeNode,
  PolygonParams,
  Primitive,
  RadialRepeatParams,
  RectParams,
  ScatterParams,
  TextParams,
  WedgeParams,
} from "@/lib/forge/types";

type Patch = (patch: Record<string, unknown>) => void;

// ---------- Linked slider pair ----------
// Two number scrubbers with an optional ratio lock between them. While
// locked, changing one drags the other along so the a/b ratio is preserved.
// The lock state is local UI state — not persisted in the doc.
type LinkedSlidersProps = {
  aName: string;
  bName: string;
  aValue: number;
  bValue: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (a: number, b: number) => void;
  defaultLinked?: boolean;
};

export function LinkedSliders({
  aName,
  bName,
  aValue,
  bValue,
  min,
  max,
  step,
  unit,
  onChange,
  defaultLinked = false,
}: LinkedSlidersProps) {
  const [linked, setLinked] = useState(defaultLinked);
  // Ratio captured at the moment of linking, so changing either side
  // doesn't slowly drift due to rounding.
  const ratioRef = useRef<number>(aValue / Math.max(bValue, 1e-6));

  const setA = (next: number) => {
    if (!linked) {
      onChange(next, bValue);
      return;
    }
    const r = ratioRef.current;
    if (!Number.isFinite(r) || r === 0) {
      onChange(next, bValue);
      return;
    }
    onChange(next, next / r);
  };
  const setB = (next: number) => {
    if (!linked) {
      onChange(aValue, next);
      return;
    }
    const r = ratioRef.current;
    if (!Number.isFinite(r)) {
      onChange(aValue, next);
      return;
    }
    onChange(next * r, next);
  };
  const toggleLink = () => {
    setLinked((l) => {
      const nextLinked = !l;
      if (nextLinked) ratioRef.current = aValue / Math.max(bValue, 1e-6);
      return nextLinked;
    });
  };

  return (
    <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-1">
      <div>
        <SliderControl
          name={aName}
          min={min}
          max={max}
          step={step}
          unit={unit}
          value={aValue}
          onChange={setA}
        />
        <SliderControl
          name={bName}
          min={min}
          max={max}
          step={step}
          unit={unit}
          value={bValue}
          onChange={setB}
        />
      </div>
      <button
        type="button"
        onClick={toggleLink}
        title={linked ? "unlink ratio" : "lock ratio"}
        className={cn(
          "flex size-6 items-center justify-center border border-border transition-colors",
          linked ? "bg-foreground text-background" : "hover:bg-muted",
        )}
      >
        {linked ? <IconLink className="size-3" /> : <IconLinkBroken className="size-3" />}
      </button>
    </div>
  );
}

// ---------- Primitives ----------

export function PrimitiveControls({
  primitive,
  onPatch,
}: {
  primitive: Primitive;
  onPatch: Patch;
}) {
  switch (primitive.kind) {
    case "rect":
      return <RectControls params={primitive.params} onPatch={onPatch} />;
    case "ellipse":
      return <EllipseControls params={primitive.params} onPatch={onPatch} />;
    case "barStack":
      return <BarStackControls params={primitive.params} onPatch={onPatch} />;
    case "wedge":
      return <WedgeControls params={primitive.params} onPatch={onPatch} />;
    case "polygon":
      return <PolygonControls params={primitive.params} onPatch={onPatch} />;
    case "text":
      return <TextControls params={primitive.params} onPatch={onPatch} />;
  }
}

function RectControls({ params, onPatch }: { params: RectParams; onPatch: Patch }) {
  return (
    <>
      <SliderControl name="x" min={-2000} max={2000} value={params.x} onChange={(v) => onPatch({ x: v })} />
      <SliderControl name="y" min={-2000} max={2000} value={params.y} onChange={(v) => onPatch({ y: v })} />
      <LinkedSliders
        aName="width"
        bName="height"
        aValue={params.w}
        bValue={params.h}
        min={0}
        max={2000}
        onChange={(w, h) => onPatch({ w, h })}
      />
      <SliderControl name="corner radius" min={0} max={500} value={params.rx} onChange={(v) => onPatch({ rx: v })} />
    </>
  );
}

function EllipseControls({ params, onPatch }: { params: EllipseParams; onPatch: Patch }) {
  return (
    <>
      <SliderControl name="center x" min={-2000} max={2000} value={params.cx} onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="center y" min={-2000} max={2000} value={params.cy} onChange={(v) => onPatch({ cy: v })} />
      <LinkedSliders
        aName="radius x"
        bName="radius y"
        aValue={params.rx}
        bValue={params.ry}
        min={0}
        max={2000}
        defaultLinked
        onChange={(rx, ry) => onPatch({ rx, ry })}
      />
    </>
  );
}

function BarStackControls({ params, onPatch }: { params: BarStackParams; onPatch: Patch }) {
  return (
    <>
      <SliderControl name="count" min={1} max={60} value={params.count} onChange={(v) => onPatch({ count: v })} />
      <SliderControl name="width" min={0} max={2000} value={params.width} unit="px" onChange={(v) => onPatch({ width: v })} />
      <SliderControl name="bar height" min={0.5} max={80} step={0.5} value={params.height} unit="px" onChange={(v) => onPatch({ height: v })} />
      <SliderControl name="gap" min={0} max={60} value={params.gap} unit="px" onChange={(v) => onPatch({ gap: v })} />
      <SliderControl name="taper" min={-100} max={100} value={params.taper} onChange={(v) => onPatch({ taper: v })} />
      <SliderControl name="jitter" min={0} max={100} value={params.jitter} unit="%" onChange={(v) => onPatch({ jitter: v })} />
      <SliderControl name="seed" min={0} max={9999} value={params.seed} onChange={(v) => onPatch({ seed: v })} />
      <SliderControl name="rotation" min={0} max={360} value={params.rotation} unit="°" onChange={(v) => onPatch({ rotation: v })} />
      <SliderControl name="center x" min={-2000} max={2000} value={params.cx} onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="center y" min={-2000} max={2000} value={params.cy} onChange={(v) => onPatch({ cy: v })} />
    </>
  );
}

function WedgeControls({ params, onPatch }: { params: WedgeParams; onPatch: Patch }) {
  return (
    <>
      <SliderControl name="center x" min={-2000} max={2000} value={params.cx} onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="center y" min={-2000} max={2000} value={params.cy} onChange={(v) => onPatch({ cy: v })} />
      <SliderControl name="outer radius" min={0} max={2000} value={params.outerRadius} onChange={(v) => onPatch({ outerRadius: v })} />
      <SliderControl name="inner radius" min={0} max={2000} value={params.innerRadius} onChange={(v) => onPatch({ innerRadius: v })} />
      <SliderControl name="start angle" min={-360} max={360} value={params.startAngle} unit="°" onChange={(v) => onPatch({ startAngle: v })} />
      <SliderControl name="sweep" min={-360} max={360} value={params.sweep} unit="°" onChange={(v) => onPatch({ sweep: v })} />
    </>
  );
}

function PolygonControls({ params, onPatch }: { params: PolygonParams; onPatch: Patch }) {
  return (
    <>
      <SliderControl name="center x" min={-2000} max={2000} value={params.cx} onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="center y" min={-2000} max={2000} value={params.cy} onChange={(v) => onPatch({ cy: v })} />
      <SliderControl name="radius" min={0} max={2000} value={params.radius} onChange={(v) => onPatch({ radius: v })} />
      <SliderControl name="sides" min={3} max={24} value={params.sides} onChange={(v) => onPatch({ sides: v })} />
      <SliderControl name="star inner" min={0} max={1} step={0.02} value={params.starInner} onChange={(v) => onPatch({ starInner: v })} />
      <SliderControl name="rotation" min={0} max={360} value={params.rotation} unit="°" onChange={(v) => onPatch({ rotation: v })} />
    </>
  );
}

function TextControls({ params, onPatch }: { params: TextParams; onPatch: Patch }) {
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
      <SegControl
        name="font"
        value={params.font}
        options={[
          { value: "mondwest", label: "mondwest" },
          { value: "neue-bit", label: "neue bit" },
          { value: "geist-pixel", label: "pixel" },
          { value: "sans", label: "sans" },
        ]}
        onChange={(v) => onPatch({ font: v })}
      />
      <SliderControl name="size" min={6} max={800} value={params.size} unit="px" onChange={(v) => onPatch({ size: v })} />
      <SliderControl name="letter spacing" min={-20} max={60} value={params.letterSpacing} onChange={(v) => onPatch({ letterSpacing: v })} />
      <SegControl
        name="anchor"
        value={params.anchor}
        options={[
          { value: "start", label: "start" },
          { value: "middle", label: "middle" },
          { value: "end", label: "end" },
        ]}
        onChange={(v) => onPatch({ anchor: v })}
      />
      <SegControl
        name="baseline"
        value={params.baseline}
        options={[
          { value: "hanging", label: "top" },
          { value: "middle", label: "middle" },
          { value: "alphabetic", label: "base" },
        ]}
        onChange={(v) => onPatch({ baseline: v })}
      />
      <SliderControl name="center x" min={-2000} max={2000} value={params.cx} onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="center y" min={-2000} max={2000} value={params.cy} onChange={(v) => onPatch({ cy: v })} />
      <SliderControl name="rotation" min={0} max={360} value={params.rotation} unit="°" onChange={(v) => onPatch({ rotation: v })} />
    </>
  );
}

// ---------- Modifiers ----------

export function ModifierControls({
  modifier,
  palette,
  nodes,
  currentNodeId,
  onPatch,
}: {
  modifier: Modifier;
  palette: string[];
  nodes: ForgeNode[];
  currentNodeId: number;
  onPatch: Patch;
}) {
  switch (modifier.kind) {
    case "linearRepeat":
      return <LinearRepeatControls params={modifier.params} onPatch={onPatch} />;
    case "radialRepeat":
      return <RadialRepeatControls params={modifier.params} onPatch={onPatch} />;
    case "gridRepeat":
      return <GridRepeatControls params={modifier.params} onPatch={onPatch} />;
    case "mirror":
      return <MirrorControls params={modifier.params} onPatch={onPatch} />;
    case "scatter":
      return <ScatterControls params={modifier.params} onPatch={onPatch} />;
    case "colorCycle":
      return <ColorCycleControls params={modifier.params} palette={palette} onPatch={onPatch} />;
    case "clip":
      return <ClipControls params={modifier.params} onPatch={onPatch} />;
    case "boolean":
      return (
        <BooleanControls
          params={modifier.params}
          nodes={nodes}
          currentNodeId={currentNodeId}
          onPatch={onPatch}
        />
      );
  }
}

function LinearRepeatControls({ params, onPatch }: { params: LinearRepeatParams; onPatch: Patch }) {
  return (
    <>
      <SliderControl name="count" min={1} max={60} value={params.count} onChange={(v) => onPatch({ count: v })} />
      <LinkedSliders
        aName="step x"
        bName="step y"
        aValue={params.dx}
        bValue={params.dy}
        min={-500}
        max={500}
        onChange={(dx, dy) => onPatch({ dx, dy })}
      />
      <SliderControl name="rotate / step" min={-180} max={180} value={params.dRotate} unit="°" onChange={(v) => onPatch({ dRotate: v })} />
      <SliderControl name="scale / step" min={-50} max={50} value={params.dScale} unit="%" onChange={(v) => onPatch({ dScale: v })} />
    </>
  );
}

function RadialRepeatControls({ params, onPatch }: { params: RadialRepeatParams; onPatch: Patch }) {
  return (
    <>
      <SliderControl name="count" min={1} max={60} value={params.count} onChange={(v) => onPatch({ count: v })} />
      <SliderControl name="arc" min={0} max={360} value={params.arc} unit="°" onChange={(v) => onPatch({ arc: v })} />
      <SliderControl name="center x" min={-2000} max={2000} value={params.cx} onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="center y" min={-2000} max={2000} value={params.cy} onChange={(v) => onPatch({ cy: v })} />
    </>
  );
}

function GridRepeatControls({ params, onPatch }: { params: GridRepeatParams; onPatch: Patch }) {
  return (
    <>
      <LinkedSliders
        aName="count x"
        bName="count y"
        aValue={params.countX}
        bValue={params.countY}
        min={1}
        max={30}
        onChange={(countX, countY) =>
          onPatch({ countX: Math.round(countX), countY: Math.round(countY) })
        }
      />
      <LinkedSliders
        aName="spacing x"
        bName="spacing y"
        aValue={params.dx}
        bValue={params.dy}
        min={0}
        max={500}
        defaultLinked
        onChange={(dx, dy) => onPatch({ dx, dy })}
      />
      <SliderControl name="row stagger" min={-500} max={500} value={params.staggerY} onChange={(v) => onPatch({ staggerY: v })} />
      <SliderControl name="rotate / cell" min={-180} max={180} value={params.cellRotate} unit="°" onChange={(v) => onPatch({ cellRotate: v })} />
    </>
  );
}

function MirrorControls({ params, onPatch }: { params: MirrorParams; onPatch: Patch }) {
  return (
    <>
      <SegControl
        name="axis"
        value={params.axis}
        options={[
          { value: "x", label: "horizontal" },
          { value: "y", label: "vertical" },
        ]}
        onChange={(v) => onPatch({ axis: v })}
      />
      <SliderControl
        name={params.axis === "x" ? "y line" : "x line"}
        min={-2000}
        max={2000}
        value={params.center}
        onChange={(v) => onPatch({ center: v })}
      />
    </>
  );
}

function ScatterControls({ params, onPatch }: { params: ScatterParams; onPatch: Patch }) {
  return (
    <>
      <LinkedSliders
        aName="offset x"
        bName="offset y"
        aValue={params.offsetX}
        bValue={params.offsetY}
        min={0}
        max={500}
        defaultLinked
        onChange={(offsetX, offsetY) => onPatch({ offsetX, offsetY })}
      />
      <SliderControl name="rotation" min={0} max={180} value={params.rotation} unit="°" onChange={(v) => onPatch({ rotation: v })} />
      <SliderControl name="scale" min={0} max={1} step={0.02} value={params.scale} onChange={(v) => onPatch({ scale: v })} />
      <SliderControl name="seed" min={0} max={9999} value={params.seed} onChange={(v) => onPatch({ seed: v })} />
    </>
  );
}

function ColorCycleControls({
  params,
  palette,
  onPatch,
}: {
  params: ColorCycleParams;
  palette: string[];
  onPatch: Patch;
}) {
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
      <SegControl
        name="mode"
        value={params.mode}
        options={[
          { value: "cycle", label: "cycle" },
          { value: "random", label: "random" },
        ]}
        onChange={(v) => onPatch({ mode: v })}
      />
      <SegControl
        name="affect"
        value={params.affect}
        options={[
          { value: "fill", label: "fill" },
          { value: "stroke", label: "stroke" },
          { value: "both", label: "both" },
        ]}
        onChange={(v) => onPatch({ affect: v })}
      />
      {params.mode === "random" && (
        <SliderControl name="seed" min={0} max={9999} value={params.seed} onChange={(v) => onPatch({ seed: v })} />
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
}

function BooleanControls({
  params,
  nodes,
  currentNodeId,
  onPatch,
}: {
  params: BooleanParams;
  nodes: ForgeNode[];
  currentNodeId: number;
  onPatch: Patch;
}) {
  const targets = nodes.filter((n) => n.id !== currentNodeId);
  return (
    <>
      <SegControl
        name="op"
        value={params.op}
        options={[
          { value: "union", label: "union" },
          { value: "subtract", label: "subtract" },
          { value: "intersect", label: "intersect" },
          { value: "exclude", label: "exclude" },
        ]}
        onChange={(v) => onPatch({ op: v })}
      />
      <div className="mb-2">
        <span className="mb-1.5 block text-xs tracking-wider text-muted-foreground uppercase">
          target node
        </span>
        <Select
          value={params.targetNodeId != null ? String(params.targetNodeId) : ""}
          onValueChange={(v) => onPatch({ targetNodeId: v ? Number(v) : null })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="— pick a node —" />
          </SelectTrigger>
          <SelectContent>
            {targets.map((n) => (
              <SelectItem key={n.id} value={String(n.id)}>
                #{n.id} · {n.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {targets.length === 0 && (
          <p className="mt-1 text-[11px] italic text-muted-foreground">
            add a second node to use as the boolean operand
          </p>
        )}
      </div>
      <ToggleControl
        name="hide target node"
        value={params.hideTarget}
        onChange={(v) => onPatch({ hideTarget: v })}
      />
    </>
  );
}

function ClipControls({ params, onPatch }: { params: ClipParams; onPatch: Patch }) {
  return (
    <>
      <SegControl
        name="shape"
        value={params.shape}
        options={[
          { value: "ellipse", label: "ellipse" },
          { value: "rect", label: "rect" },
        ]}
        onChange={(v) => onPatch({ shape: v })}
      />
      <SliderControl name="center x" min={-2000} max={2000} value={params.cx} onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="center y" min={-2000} max={2000} value={params.cy} onChange={(v) => onPatch({ cy: v })} />
      <LinkedSliders
        aName="width"
        bName="height"
        aValue={params.w}
        bValue={params.h}
        min={0}
        max={4000}
        defaultLinked
        onChange={(w, h) => onPatch({ w, h })}
      />
      <ToggleControl
        name="invert (keep outside)"
        value={params.invert}
        onChange={(v) => onPatch({ invert: v })}
      />
    </>
  );
}

// ---------- Node style ----------

export function NodeStyleControls({
  fill,
  fillEnabled,
  stroke,
  strokeEnabled,
  strokeWidth,
  opacity,
  palette,
  onPatch,
}: {
  fill: string;
  fillEnabled: boolean;
  stroke: string;
  strokeEnabled: boolean;
  strokeWidth: number;
  opacity: number;
  palette: string[];
  onPatch: (patch: Partial<{
    fill: string;
    fillEnabled: boolean;
    stroke: string;
    strokeEnabled: boolean;
    strokeWidth: number;
    opacity: number;
  }>) => void;
}) {
  return (
    <>
      <ToggleControl
        name="fill"
        value={fillEnabled}
        onChange={(v) => onPatch({ fillEnabled: v })}
      />
      {fillEnabled && (
        <>
          <ColorControl name="fill color" value={fill} onChange={(v) => onPatch({ fill: v })} />
          {palette.length > 0 && (
            <PaletteSwatches palette={palette} onPick={(v) => onPatch({ fill: v })} />
          )}
        </>
      )}
      <ToggleControl
        name="stroke"
        value={strokeEnabled}
        onChange={(v) => onPatch({ strokeEnabled: v })}
      />
      {strokeEnabled && (
        <>
          <ColorControl name="stroke color" value={stroke} onChange={(v) => onPatch({ stroke: v })} />
          {palette.length > 0 && (
            <PaletteSwatches palette={palette} onPick={(v) => onPatch({ stroke: v })} />
          )}
          <SliderControl name="stroke width" min={0} max={40} value={strokeWidth} unit="px" onChange={(v) => onPatch({ strokeWidth: v })} />
        </>
      )}
      <SliderControl name="opacity" min={0} max={1} step={0.05} value={opacity} onChange={(v) => onPatch({ opacity: v })} />
    </>
  );
}

function PaletteSwatches({ palette, onPick }: { palette: string[]; onPick: (c: string) => void }) {
  return (
    <div className="-mt-1 mb-2 flex flex-wrap gap-1">
      {palette.map((c, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(c)}
          title={c}
          className="size-5 border border-border hover:border-foreground"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

// ---------- Document-level controls (palette, grain) ----------

export function PaletteEditor({
  palette,
  onChange,
}: {
  palette: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mb-1 flex w-full items-center justify-between text-xs tracking-wider text-muted-foreground uppercase"
      >
        <span>palette ({palette.length})</span>
        <span className="font-mono text-foreground/80">{open ? "−" : "+"}</span>
      </button>
      <div className="flex flex-wrap gap-1">
        {palette.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <ColorPicker
              value={c}
              onChange={(v) => {
                const next = [...palette];
                next[i] = v;
                onChange(next);
              }}
            />
            {open && (
              <button
                type="button"
                onClick={() => onChange(palette.filter((_, idx) => idx !== i))}
                className="text-[10px] tracking-wider text-muted-foreground uppercase hover:text-destructive"
              >
                remove
              </button>
            )}
          </div>
        ))}
        {open && (
          <button
            type="button"
            onClick={() => onChange([...palette, "#ffffff"])}
            className={cn(
              "flex h-6 items-center justify-center border border-dashed border-border px-2 text-[10px] tracking-wider uppercase hover:bg-muted",
            )}
          >
            <IconPlus className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function GrainControls({
  grain,
  onPatch,
}: {
  grain: GrainParams;
  onPatch: (patch: Partial<GrainParams>) => void;
}) {
  return (
    <>
      <ToggleControl
        name="enabled"
        value={grain.enabled}
        onChange={(v) => onPatch({ enabled: v })}
      />
      {grain.enabled && (
        <>
          <SliderControl name="amount" min={0} max={1} step={0.02} value={grain.amount} onChange={(v) => onPatch({ amount: v })} />
          <SliderControl name="frequency" min={0.05} max={3} step={0.05} value={grain.frequency} onChange={(v) => onPatch({ frequency: v })} />
          <SliderControl name="octaves" min={1} max={5} value={grain.octaves} onChange={(v) => onPatch({ octaves: v })} />
          <SliderControl name="seed" min={0} max={9999} value={grain.seed} onChange={(v) => onPatch({ seed: v })} />
          <ToggleControl
            name="monochrome"
            value={grain.monochrome}
            onChange={(v) => onPatch({ monochrome: v })}
          />
        </>
      )}
    </>
  );
}

// Used by other places that want a Button consistent with the rest:
export { Button };
