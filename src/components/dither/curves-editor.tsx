import { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CURVES_DEFAULTS,
  isIdentityCurve,
  sampleCurve,
  type CurveChannel,
  type CurvePoint,
  type CurvesParams,
} from "@/lib/dither/curves";

const CANVAS = 200;
const PAD = 10;
const VIEWBOX = CANVAS + PAD * 2;
const HIT_RADIUS = 9;
const EPS = 0.0015; // minimum x-gap between adjacent points

const CHANNELS: { id: CurveChannel; label: string; stroke: string }[] = [
  { id: "rgb", label: "rgb", stroke: "var(--foreground)" },
  { id: "r", label: "r", stroke: "oklch(0.62 0.21 25)" },
  { id: "g", label: "g", stroke: "oklch(0.65 0.19 145)" },
  { id: "b", label: "b", stroke: "oklch(0.55 0.21 260)" },
];

function clamp(n: number, lo: number, hi: number) {
  return n < lo ? lo : n > hi ? hi : n;
}

type CurvesEditorProps = {
  value: CurvesParams;
  onChange: (next: CurvesParams) => void;
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
};

export function CurvesEditor({
  value,
  onChange,
  onInteractStart,
  onInteractEnd,
}: CurvesEditorProps) {
  const channel = value.activeChannel;
  const points = value[channel];
  const channelMeta = CHANNELS.find((c) => c.id === channel)!;

  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const toSvg = useCallback((p: CurvePoint) => {
    return { x: PAD + p.x * CANVAS, y: PAD + (1 - p.y) * CANVAS };
  }, []);

  const fromSvgClient = useCallback((clientX: number, clientY: number): CurvePoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * VIEWBOX;
    const sy = ((clientY - rect.top) / rect.height) * VIEWBOX;
    return {
      x: clamp((sx - PAD) / CANVAS, 0, 1),
      y: clamp(1 - (sy - PAD) / CANVAS, 0, 1),
    };
  }, []);

  const findPoint = useCallback(
    (clientX: number, clientY: number): number | null => {
      const rect = svgRef.current!.getBoundingClientRect();
      const scaleX = rect.width / VIEWBOX;
      const scaleY = rect.height / VIEWBOX;
      for (let i = points.length - 1; i >= 0; i--) {
        const sp = toSvg(points[i]);
        const dx = (clientX - rect.left) - sp.x * scaleX;
        const dy = (clientY - rect.top) - sp.y * scaleY;
        if (Math.hypot(dx, dy) < HIT_RADIUS) return i;
      }
      return null;
    },
    [points, toSvg],
  );

  const setChannelPoints = useCallback(
    (next: CurvePoint[]) => {
      onChange({ ...value, [channel]: next });
    },
    [onChange, value, channel],
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const idx = findPoint(e.clientX, e.clientY);

    // double-click on an interior point → delete
    if (e.detail === 2 && idx !== null && idx > 0 && idx < points.length - 1) {
      setChannelPoints(points.filter((_, i) => i !== idx));
      return;
    }

    onInteractStart?.();

    if (idx === null) {
      const np = fromSvgClient(e.clientX, e.clientY);
      const next = [...points, np].sort((a, b) => a.x - b.x);
      const newIdx = next.findIndex((p) => p === np);
      setChannelPoints(next);
      setDraggingIdx(newIdx);
    } else {
      setDraggingIdx(idx);
    }
    svgRef.current!.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIdx === null) return;
    const raw = fromSvgClient(e.clientX, e.clientY);
    // First point can range from 0 up to (next - EPS); last from (prev + EPS) up to 1.
    // Interior points are clamped between their neighbors. y is always free.
    const last = points.length - 1;
    const left = draggingIdx === 0 ? 0 : points[draggingIdx - 1].x + EPS;
    const right = draggingIdx === last ? 1 : points[draggingIdx + 1].x - EPS;
    const np = { x: clamp(raw.x, left, right), y: raw.y };
    const next = [...points];
    next[draggingIdx] = np;
    setChannelPoints(next);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIdx === null) return;
    setDraggingIdx(null);
    svgRef.current!.releasePointerCapture(e.pointerId);
    onInteractEnd?.();
  };

  const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    const idx = findPoint(e.clientX, e.clientY);
    if (idx === null || idx === 0 || idx === points.length - 1) return;
    setChannelPoints(points.filter((_, i) => i !== idx));
  };

  const resetChannel = () => {
    onChange({ ...value, [channel]: [...CURVES_DEFAULTS[channel]] });
  };

  const resetAll = () => {
    onChange({
      ...CURVES_DEFAULTS,
      activeChannel: channel,
    });
  };

  // Build the curve path (sampled, monotonic-cubic).
  const curvePath = useMemo(() => {
    const samples = sampleCurve(points, 96);
    return samples
      .map((p, i) => {
        const sp = toSvg(p);
        return `${i === 0 ? "M" : "L"}${sp.x.toFixed(2)},${sp.y.toFixed(2)}`;
      })
      .join(" ");
  }, [points, toSvg]);

  const dirty = !isIdentityCurve(points);

  return (
    <div className="mb-2 space-y-2">
      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-0.5">
          {CHANNELS.map((c) => {
            const isActive = c.id === channel;
            const isDirty = !isIdentityCurve(value[c.id]);
            return (
              <Button
                key={c.id}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="relative h-7 w-9 rounded-none px-0 lowercase"
                onClick={() => onChange({ ...value, activeChannel: c.id })}
              >
                <span>{c.label}</span>
                {isDirty && (
                  <span
                    className={cn(
                      "absolute right-1 top-1 size-1 rounded-full",
                      isActive ? "bg-background" : "bg-foreground",
                    )}
                  />
                )}
              </Button>
            );
          })}
        </div>
        <div className="flex gap-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-none px-2 text-xs lowercase"
            disabled={!dirty}
            onClick={resetChannel}
          >
            reset
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-none px-2 text-xs lowercase"
            onClick={resetAll}
          >
            all
          </Button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="block w-full touch-none border border-border bg-muted/40 select-none"
        style={{ aspectRatio: "1 / 1" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
      >
        {/* grid */}
        <g stroke="var(--border)" strokeWidth="0.5" opacity="0.7">
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={`vx-${t}`}
              x1={PAD + t * CANVAS}
              x2={PAD + t * CANVAS}
              y1={PAD}
              y2={PAD + CANVAS}
            />
          ))}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={`hy-${t}`}
              x1={PAD}
              x2={PAD + CANVAS}
              y1={PAD + t * CANVAS}
              y2={PAD + t * CANVAS}
            />
          ))}
          <rect
            x={PAD}
            y={PAD}
            width={CANVAS}
            height={CANVAS}
            fill="none"
            stroke="var(--border)"
          />
        </g>

        {/* identity diagonal */}
        <line
          x1={PAD}
          y1={PAD + CANVAS}
          x2={PAD + CANVAS}
          y2={PAD}
          stroke="var(--muted-foreground)"
          strokeWidth="0.7"
          strokeDasharray="2 3"
          opacity="0.5"
        />

        {/* curve path */}
        <path
          d={curvePath}
          fill="none"
          stroke={channelMeta.stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* control points */}
        {points.map((p, i) => {
          const sp = toSvg(p);
          return (
            <rect
              key={i}
              x={sp.x - 3.5}
              y={sp.y - 3.5}
              width={7}
              height={7}
              fill="var(--background)"
              stroke={channelMeta.stroke}
              strokeWidth="1.5"
            />
          );
        })}
      </svg>

      <p className="text-xs text-muted-foreground leading-tight">
        click to add · drag to shape · right-click or double-click to remove
      </p>
    </div>
  );
}
