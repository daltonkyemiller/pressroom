import { useEffect, useRef, useState } from "react";
import { IconLink, IconLinkBroken } from "nucleo-pixel";
import { SliderControl } from "@/components/dither/controls";
import { cn } from "@/lib/utils";

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
  // Ratio captured at link time so changing either side doesn't slowly
  // drift due to rounding during a drag.
  const ratioRef = useRef<number>(aValue / Math.max(bValue, 1e-6));
  // Track the (a, b) tuple we most recently emitted via onChange so we
  // can detect *external* value changes — anything that didn't come
  // through setA/setB. When the host re-shapes the doc out from under
  // us (fit-to-content, undo, preset load), the ratio has to refresh
  // or the next drag snaps back to the stale ratio. The drift fix
  // above is preserved because internal changes match `lastEmitted`
  // and skip the refresh.
  const lastEmittedRef = useRef<{ a: number; b: number }>({ a: aValue, b: bValue });
  useEffect(() => {
    const last = lastEmittedRef.current;
    if (last.a === aValue && last.b === bValue) return;
    ratioRef.current = aValue / Math.max(bValue, 1e-6);
    lastEmittedRef.current = { a: aValue, b: bValue };
  }, [aValue, bValue]);

  const emit = (a: number, b: number) => {
    lastEmittedRef.current = { a, b };
    onChange(a, b);
  };
  const setA = (next: number) => {
    if (!linked) {
      emit(next, bValue);
      return;
    }
    const r = ratioRef.current;
    if (!Number.isFinite(r) || r === 0) {
      emit(next, bValue);
      return;
    }
    emit(next, next / r);
  };
  const setB = (next: number) => {
    if (!linked) {
      emit(aValue, next);
      return;
    }
    const r = ratioRef.current;
    if (!Number.isFinite(r)) {
      emit(aValue, next);
      return;
    }
    emit(next * r, next);
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
        <SliderControl name={aName} min={min} max={max} step={step} unit={unit}
          value={aValue} onChange={setA} />
        <SliderControl name={bName} min={min} max={max} step={step} unit={unit}
          value={bValue} onChange={setB} />
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
