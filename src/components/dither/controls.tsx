import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PALETTES, PALETTE_META, type PaletteId } from "@/lib/dither/palettes";
import { ColorPicker } from "./color-picker";
import { NumberScrubber } from "./number-scrubber";

// ---------- Scrubber (replaces classic slider) ----------
type ScrubberControlProps = {
  name: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  onCommit?: () => void;
  onStart?: () => void;
};

export function SliderControl({
  name,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  onStart,
}: ScrubberControlProps) {
  return (
    <div className="mb-2 last:mb-0">
      <NumberScrubber
        label={name}
        value={value}
        unit={unit}
        min={min}
        max={max}
        step={step}
        onValueChange={onChange}
        onInteractStart={onStart}
        onInteractEnd={onCommit}
      />
    </div>
  );
}

// ---------- Segmented selector (button group) ----------
type SegOption<T extends string> = { value: T; label: string };

type SegControlProps<T extends string> = {
  name: string;
  value: T;
  options: readonly SegOption<T>[];
  cols?: number;
  onChange: (v: T) => void;
};

export function SegControl<T extends string>({
  name,
  value,
  options,
  cols,
  onChange,
}: SegControlProps<T>) {
  const c = cols ?? (options.length <= 2 ? 2 : options.length <= 4 ? options.length : 4);
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-xs tracking-wider text-muted-foreground uppercase">
        {name}
      </span>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))` }}>
        {options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={value === opt.value ? "default" : "outline"}
            size="sm"
            className="rounded-none px-1.5"
            onClick={() => onChange(opt.value)}
          >
            <span className="lowercase">{opt.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

// ---------- Palette picker ----------
type PaletteControlProps = {
  name: string;
  value: PaletteId;
  onChange: (id: PaletteId) => void;
};

export function PaletteControl({ name, value, onChange }: PaletteControlProps) {
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-xs tracking-wider text-muted-foreground uppercase">
        {name}
      </span>
      <div className="grid grid-cols-3 gap-0.5">
        {PALETTE_META.map((meta) => {
          const colors = PALETTES[meta.id];
          const active = value === meta.id;
          return (
            <button
              key={meta.id}
              type="button"
              aria-label={meta.label}
              onClick={() => onChange(meta.id)}
              className={cn(
                "relative flex aspect-[2.4/1] border border-border cursor-pointer",
                active && "outline outline-2 outline-offset-1 outline-foreground",
              )}
            >
              {colors.map((c, i) => (
                <span
                  key={i}
                  className="flex-1"
                  style={{ background: `rgb(${c[0]},${c[1]},${c[2]})` }}
                />
              ))}
              <span className="absolute bottom-0.5 left-1 text-[10px] tracking-wider text-white mix-blend-difference">
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Toggle row ----------
type ToggleControlProps = {
  name: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

export function ToggleControl({ name, value, onChange }: ToggleControlProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5">
      <span className="text-xs tracking-wider lowercase">{name}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  );
}

// ---------- Color (hex) ----------
type ColorControlProps = {
  name: string;
  value: string;
  onChange: (v: string) => void;
};

export function ColorControl({ name, value, onChange }: ColorControlProps) {
  return (
    <div className="mb-2 flex items-center justify-between py-1.5">
      <span className="text-xs tracking-wider lowercase">{name}</span>
      <ColorPicker value={value} onChange={onChange} />
    </div>
  );
}
