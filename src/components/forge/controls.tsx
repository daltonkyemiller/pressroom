// Param controls per primitive + modifier kind. Reuses pressroom's
// SliderControl / SegControl / ToggleControl / ColorControl primitives.

import {
  ColorControl,
  SegControl,
  SliderControl,
  ToggleControl,
} from "@/components/dither/controls";
import type {
  BarStackParams,
  ClipParams,
  EllipseParams,
  LinearRepeatParams,
  MirrorParams,
  Modifier,
  Primitive,
  RadialRepeatParams,
  RectParams,
} from "@/lib/forge/types";

type Patch = (patch: Record<string, unknown>) => void;

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
  }
}

function RectControls({ params, onPatch }: { params: RectParams; onPatch: Patch }) {
  return (
    <>
      <SliderControl name="x" min={-2000} max={2000} value={params.x} onChange={(v) => onPatch({ x: v })} />
      <SliderControl name="y" min={-2000} max={2000} value={params.y} onChange={(v) => onPatch({ y: v })} />
      <SliderControl name="width" min={0} max={2000} value={params.w} onChange={(v) => onPatch({ w: v })} />
      <SliderControl name="height" min={0} max={2000} value={params.h} onChange={(v) => onPatch({ h: v })} />
      <SliderControl name="corner radius" min={0} max={500} value={params.rx} onChange={(v) => onPatch({ rx: v })} />
    </>
  );
}

function EllipseControls({ params, onPatch }: { params: EllipseParams; onPatch: Patch }) {
  return (
    <>
      <SliderControl name="center x" min={-2000} max={2000} value={params.cx} onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="center y" min={-2000} max={2000} value={params.cy} onChange={(v) => onPatch({ cy: v })} />
      <SliderControl name="radius x" min={0} max={2000} value={params.rx} onChange={(v) => onPatch({ rx: v })} />
      <SliderControl name="radius y" min={0} max={2000} value={params.ry} onChange={(v) => onPatch({ ry: v })} />
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
      <SliderControl name="anchor x" min={-2000} max={2000} value={params.cx} onChange={(v) => onPatch({ cx: v })} />
      <SliderControl name="anchor y" min={-2000} max={2000} value={params.cy} onChange={(v) => onPatch({ cy: v })} />
    </>
  );
}

export function ModifierControls({
  modifier,
  onPatch,
}: {
  modifier: Modifier;
  onPatch: Patch;
}) {
  switch (modifier.kind) {
    case "linearRepeat":
      return <LinearRepeatControls params={modifier.params} onPatch={onPatch} />;
    case "radialRepeat":
      return <RadialRepeatControls params={modifier.params} onPatch={onPatch} />;
    case "mirror":
      return <MirrorControls params={modifier.params} onPatch={onPatch} />;
    case "clip":
      return <ClipControls params={modifier.params} onPatch={onPatch} />;
  }
}

function LinearRepeatControls({ params, onPatch }: { params: LinearRepeatParams; onPatch: Patch }) {
  return (
    <>
      <SliderControl name="count" min={1} max={40} value={params.count} onChange={(v) => onPatch({ count: v })} />
      <SliderControl name="step x" min={-500} max={500} value={params.dx} onChange={(v) => onPatch({ dx: v })} />
      <SliderControl name="step y" min={-500} max={500} value={params.dy} onChange={(v) => onPatch({ dy: v })} />
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
      <SliderControl name="width" min={0} max={4000} value={params.w} onChange={(v) => onPatch({ w: v })} />
      <SliderControl name="height" min={0} max={4000} value={params.h} onChange={(v) => onPatch({ h: v })} />
      <ToggleControl
        name="invert (keep outside)"
        value={params.invert}
        onChange={(v) => onPatch({ invert: v })}
      />
    </>
  );
}

export function NodeStyleControls({
  fill,
  stroke,
  strokeWidth,
  opacity,
  onPatch,
}: {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  onPatch: (patch: { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }) => void;
}) {
  return (
    <>
      <ColorControl name="fill" value={fill} onChange={(v) => onPatch({ fill: v })} />
      <ColorControl name="stroke" value={stroke} onChange={(v) => onPatch({ stroke: v })} />
      <SliderControl name="stroke width" min={0} max={40} value={strokeWidth} unit="px" onChange={(v) => onPatch({ strokeWidth: v })} />
      <SliderControl name="opacity" min={0} max={1} step={0.05} value={opacity} onChange={(v) => onPatch({ opacity: v })} />
    </>
  );
}
