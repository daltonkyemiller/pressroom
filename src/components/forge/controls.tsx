import { useState, useSyncExternalStore } from "react";
import { IconPlus } from "nucleo-pixel";
import {
  listFonts,
  loadLocalFonts,
  subscribeFonts,
} from "@/lib/forge/font-registry";
import {
  ColorControl,
  SliderControl,
  ToggleControl,
} from "@/components/dither/controls";
import { ColorPicker } from "@/components/dither/color-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { primitiveControlsFor } from "@/lib/forge/primitives/controls-registry";
import { modifierControlsFor } from "@/lib/forge/modifiers/controls-registry";
import type {
  GrainParams,
  Modifier,
  Node as ForgeNode,
  Primitive,
} from "@/lib/forge/types";

type Patch = (patch: Record<string, unknown>) => void;

// Re-export so existing callers can keep importing LinkedSliders from this
// file. Primitive controls now live next to their runtime modules.
export { LinkedSliders } from "@/components/forge/linked-sliders";

// ---------- Primitives ----------
//
// Per-kind controls now live next to their runtime modules in
// `src/lib/forge/primitives/<kind>/controls.tsx`. The registry lookup
// replaces the 7-arm switch that used to live here. The `as never` cast
// bridges TS's correlated-union limitation.

export function PrimitiveControls({
  primitive,
  onPatch,
}: {
  primitive: Primitive;
  onPatch: Patch;
}) {
  const Controls = primitiveControlsFor(primitive.kind);
  return <Controls params={primitive.params as never} onPatch={onPatch} />;
}

function useFontList() {
  return useSyncExternalStore(
    subscribeFonts,
    () => listFonts(),
    () => listFonts(),
  );
}

// ---------- Modifiers ----------

// Per-kind controls live next to their runtime modules at
// `src/lib/forge/modifiers/<kind>/controls.tsx`. The registry lookup
// replaces the 8-arm switch that used to live here.
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
  const Controls = modifierControlsFor(modifier.kind);
  return (
    <Controls
      params={modifier.params as never}
      palette={palette}
      nodes={nodes}
      currentNodeId={currentNodeId}
      onPatch={onPatch}
    />
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

export function FontsSection() {
  const fonts = useFontList();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supported =
    typeof window !== "undefined" && "queryLocalFonts" in window;

  const loadLocal = async () => {
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

  const localCount = fonts.filter((f) => f.source === "local").length;

  return (
    <>
      {supported ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between"
          onClick={loadLocal}
          disabled={busy}
        >
          <span className="lowercase">
            {localCount > 0 ? `${localCount} local fonts loaded` : "use local fonts"}
          </span>
          <span className="text-muted-foreground">{busy ? "…" : "→"}</span>
        </Button>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">
          local fonts API not supported in this browser
        </p>
      )}
      {status && (
        <p className="mt-1 text-[11px] text-muted-foreground">{status}</p>
      )}
    </>
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
