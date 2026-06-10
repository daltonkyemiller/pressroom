import { useState, useSyncExternalStore } from "react";
import { IconCopy, IconStack3Plus, IconXmark } from "nucleo-pixel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  copyStackToClipboard,
  deletePreset,
  listPresets,
  loadPresetLayers,
  parseStackPayload,
  savePreset,
  type StackPreset,
} from "@/lib/dither/presets";
import type { Layer } from "@/lib/dither/effects";

type StackMenuProps = {
  layers: readonly Layer[];
  nextLayerId: () => number;
  // Called whenever a preset is loaded, the clipboard is pasted, or any
  // other action replaces the live stack. Receives the new layer list.
  onApplyLayers: (layers: Layer[]) => void;
};

// ---------- subscribable preset store ----------
// Components re-render when presets change (save / delete) via a tiny
// version counter. Keeps the snapshot reference stable until something
// actually mutates so useSyncExternalStore doesn't loop.

const listeners = new Set<() => void>();
let snapshot: StackPreset[] = listPresets();

function notify() {
  snapshot = listPresets();
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function StackMenu({ layers, nextLayerId, onApplyLayers }: StackMenuProps) {
  const presets = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
  const [status, setStatus] = useState<string | null>(null);

  function flash(message: string) {
    setStatus(message);
    window.setTimeout(() => {
      setStatus((s) => (s === message ? null : s));
    }, 1800);
  }

  async function onSave() {
    const name = window.prompt("Preset name:");
    if (!name) return;
    savePreset(name, layers);
    notify();
    flash(`saved "${name}"`);
  }

  async function onCopy() {
    try {
      await copyStackToClipboard(layers);
      flash("stack copied");
    } catch {
      flash("copy failed");
    }
  }

  async function onPaste() {
    let text: string | null = null;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      // readText needs user gesture + clipboard-read permission; if it's
      // unavailable, fall back to prompt() so we don't dead-end the user.
      text = window.prompt("Paste a pressroom stack payload:");
    }
    if (!text) return;
    const next = parseStackPayload(text, nextLayerId);
    if (!next) {
      flash("not a pressroom stack");
      return;
    }
    onApplyLayers(next);
    flash(`pasted ${next.length} effects`);
  }

  function onLoad(preset: StackPreset) {
    onApplyLayers(loadPresetLayers(preset, nextLayerId));
    flash(`loaded "${preset.name}"`);
  }

  function onDelete(preset: StackPreset) {
    deletePreset(preset.id);
    notify();
    flash(`deleted "${preset.name}"`);
  }

  return (
    <div className="space-y-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 border border-dashed border-border bg-transparent px-3 py-2 text-xs tracking-widest uppercase transition-colors hover:bg-foreground hover:text-background hover:border-solid"
            >
              <span className="inline-flex items-center gap-2">
                <IconStack3Plus className="size-3.5" /> stack
              </span>
              <span className="text-muted-foreground group-hover:text-background">
                {presets.length > 0 ? `${presets.length} saved` : "presets"}
              </span>
            </button>
          }
        />
        <DropdownMenuContent align="start" side="top" className="w-[280px]">
          <DropdownMenuItem onClick={onSave} className="lowercase">
            save current as…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopy} className="lowercase">
            <IconCopy className="mr-1.5 size-3" />
            copy stack to clipboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPaste} className="lowercase">
            paste stack from clipboard
          </DropdownMenuItem>
          {presets.length > 0 && <DropdownMenuSeparator />}
          {presets.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => onLoad(preset)}
              className="flex items-center justify-between gap-2"
            >
              <span className="lowercase truncate">{preset.name}</span>
              <span className="flex items-center gap-1 shrink-0">
                <span className="font-mondwest text-xs text-muted-foreground">
                  {preset.layers.length}fx
                </span>
                <button
                  type="button"
                  title="delete preset"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(preset);
                  }}
                  className="flex size-4 items-center justify-center text-muted-foreground hover:text-destructive"
                >
                  <IconXmark className="size-2.5" />
                </button>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {status && (
        <p
          className={cn(
            "text-[10px] tracking-widest text-muted-foreground uppercase",
          )}
        >
          {status}
        </p>
      )}
    </div>
  );
}
