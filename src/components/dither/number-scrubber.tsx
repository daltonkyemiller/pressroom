import * as React from "react";

import { cn } from "@/lib/utils";

interface NumberScrubberProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  snapPoints?: readonly number[];
  disabled?: boolean;
  className?: string;
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
}

interface ScrubberStyle extends React.CSSProperties {
  "--scrubber-progress": string;
}

const DEFAULT_STEP = 1;
const SNAP_THRESHOLD_RATIO = 0.012;

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number, min: number) {
  const snapped = Math.round((value - min) / step) * step + min;
  const decimals = step.toString().split(".")[1]?.length ?? 0;
  return Number(snapped.toFixed(decimals));
}

function snapValue(
  value: number,
  min: number,
  max: number,
  step: number,
  snapPoints: readonly number[],
) {
  const steppedValue = roundToStep(clampValue(value, min, max), step, min);
  const threshold = Math.max(step, (max - min) * SNAP_THRESHOLD_RATIO);

  for (const snapPoint of snapPoints) {
    if (Math.abs(steppedValue - snapPoint) <= threshold) {
      return clampValue(snapPoint, min, max);
    }
  }

  return steppedValue;
}

function formatValue(value: number) {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function NumberScrubber({
  label,
  value,
  onValueChange,
  min,
  max,
  step = DEFAULT_STEP,
  unit,
  snapPoints = [],
  disabled = false,
  className,
  onInteractStart,
  onInteractEnd,
}: NumberScrubberProps) {
  const labelId = React.useId();
  const [draftValue, setDraftValue] = React.useState(formatValue(value));
  const [isEditing, setIsEditing] = React.useState(false);

  const initialValueRef = React.useRef(value);
  const lastPointerDownAtRef = React.useRef(0);

  React.useEffect(() => {
    if (isEditing) return;
    setDraftValue(formatValue(value));
  }, [isEditing, value]);

  const progress = ((clampValue(value, min, max) - min) / (max - min)) * 100;
  const style: ScrubberStyle = {
    "--scrubber-progress": `${progress}%`,
  };

  const commitDraftValue = React.useCallback(() => {
    const nextValue = Number.parseFloat(draftValue);

    if (!Number.isFinite(nextValue)) {
      setDraftValue(formatValue(value));
      return;
    }

    const clampedValue = clampValue(nextValue, min, max);
    onValueChange(clampedValue);
    setDraftValue(formatValue(clampedValue));
  }, [draftValue, max, min, onValueChange, value]);

  const updateFromPointer = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement> | PointerEvent, element: HTMLDivElement) => {
      const rect = element.getBoundingClientRect();
      const ratio = clampValue((event.clientX - rect.left) / rect.width, 0, 1);
      const rawValue = min + ratio * (max - min);
      const nextValue = snapValue(rawValue, min, max, step, snapPoints);
      onValueChange(nextValue);
    },
    [max, min, onValueChange, snapPoints, step],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;

    // Double-click resets to the initial value. We can't rely on event.detail
    // here because pointer capture during the first drag breaks the browser's
    // click-count chain (the second pointerdown comes in as detail=1). Track
    // timestamps manually so the reset works regardless of pen/touch/mouse.
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const isDoubleClick = now - lastPointerDownAtRef.current < 300;
    lastPointerDownAtRef.current = now;
    if (isDoubleClick) {
      event.preventDefault();
      lastPointerDownAtRef.current = 0;
      onValueChange(initialValueRef.current);
      return;
    }

    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    document.body.classList.add("dragging");
    onInteractStart?.();
    updateFromPointer(event, element);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateFromPointer(moveEvent, element);
    };

    const handlePointerUp = () => {
      document.body.classList.remove("dragging");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      onInteractEnd?.();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      setDraftValue(formatValue(value));
      event.currentTarget.blur();
    }
  };

  return (
    <div className={cn("space-y-1.5 select-none", className)}>
      <div
        className={cn(
          "group border-input bg-muted/60 relative flex h-8 cursor-ew-resize select-none items-center rounded-none border text-xs transition-[border-color,box-shadow,background-color]",
          "before:bg-foreground/15 before:absolute before:inset-y-0 before:left-0 before:w-(--scrubber-progress)",
          "hover:border-ring/70 focus-within:border-ring focus-within:ring-ring/30 focus-within:ring-1",
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
        )}
        style={style}
        onPointerDown={handlePointerDown}
      >
        <span
          id={labelId}
          className="text-muted-foreground relative flex-1 select-none truncate px-2.5 text-xs tracking-wider lowercase"
        >
          {label}
        </span>
        <div className="bg-background/45 relative flex h-full items-center gap-0.5 px-2">
          <input
            aria-labelledby={labelId}
            className="text-foreground h-full w-10 cursor-text select-text bg-transparent text-right text-sm tabular-nums outline-none"
            disabled={disabled}
            inputMode="decimal"
            value={draftValue}
            onBlur={() => {
              setIsEditing(false);
              commitDraftValue();
              onInteractEnd?.();
            }}
            onChange={(event) => setDraftValue(event.target.value)}
            onFocus={(event) => {
              setIsEditing(true);
              onInteractStart?.();
              // Select the whole value so a typed digit replaces it cleanly.
              event.currentTarget.select();
            }}
            onKeyDown={handleInputKeyDown}
            onPointerDown={(event) => event.stopPropagation()}
          />
          {unit && <span className="text-muted-foreground text-xs tabular-nums">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

export { NumberScrubber };
