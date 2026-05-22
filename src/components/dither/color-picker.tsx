import { HexColorInput, HexColorPicker } from "react-colorful";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import "./color-picker.css";

const PRESETS = [
  "#000000",
  "#0a0a0a",
  "#1a1a1a",
  "#3a2418",
  "#efece6",
  "#ffffff",
  "#ff4d2e",
  "#ff8800",
  "#ffeac0",
  "#00ffd5",
  "#0a1e2a",
  "#aa3bff",
];

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  className?: string;
};

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const normalized = value.toUpperCase();
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-foreground",
              className,
            )}
            aria-label={`pick color (current ${normalized})`}
          >
            <span
              className="size-4 border border-border"
              style={{ background: normalized }}
            />
            <span className="tabular-nums">{normalized}</span>
          </button>
        }
      />
      <PopoverContent
        side="left"
        align="start"
        sideOffset={8}
        className="w-[228px] rounded-none border border-border bg-background p-3"
      >
        <div className="color-picker">
          <HexColorPicker color={normalized} onChange={onChange} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs tracking-wider text-muted-foreground uppercase">hex</span>
          <HexColorInput
            color={normalized}
            onChange={onChange}
            prefixed
            className="h-7 flex-1 border border-border bg-background px-2 text-xs tabular-nums uppercase outline-none focus-visible:border-foreground"
          />
        </div>
        <div className="mt-3">
          <span className="mb-1.5 block text-xs tracking-widest text-muted-foreground uppercase">
            presets
          </span>
          <div className="grid grid-cols-6 gap-1">
            {PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => onChange(color)}
                className={cn(
                  "aspect-square border border-border transition-transform hover:scale-110",
                  normalized === color.toUpperCase() &&
                    "outline outline-2 outline-offset-1 outline-foreground",
                )}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
