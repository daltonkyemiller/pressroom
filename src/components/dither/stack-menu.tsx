import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconCopy, IconStack3Plus, IconXmark } from "nucleo-pixel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
  onApplyLayers: (layers: Layer[]) => void;
};

// ---------- subscribable preset store ----------

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
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  function flash(message: string) {
    setStatus(message);
    window.setTimeout(() => {
      setStatus((s) => (s === message ? null : s));
    }, 1800);
  }

  function openSaveDialog() {
    setSaveName("");
    setSaveOpen(true);
  }

  function confirmSave() {
    const name = saveName.trim();
    if (!name) return;
    savePreset(name, layers);
    notify();
    setSaveOpen(false);
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
      // clipboard.readText needs an explicit permission / secure context;
      // when it's unavailable, fall back to a paste dialog instead of
      // dead-ending the user.
      setPasteText("");
      setPasteOpen(true);
      return;
    }
    if (!text) {
      flash("clipboard empty");
      return;
    }
    applyPayload(text);
  }

  function applyPayload(text: string) {
    const next = parseStackPayload(text, nextLayerId);
    if (!next) {
      flash("not a pressroom stack");
      return;
    }
    onApplyLayers(next);
    flash(`pasted ${next.length} effects`);
  }

  function confirmPaste() {
    const text = pasteText.trim();
    if (!text) return;
    applyPayload(text);
    setPasteOpen(false);
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

  // Autofocus the input when the save dialog opens so the user can just
  // start typing.
  const saveInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (saveOpen) saveInputRef.current?.focus();
  }, [saveOpen]);

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
          <DropdownMenuItem onClick={openSaveDialog} className="lowercase">
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
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
          {status}
        </p>
      )}

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save preset</DialogTitle>
            <DialogDescription>
              Saves the current effect stack to local storage. Reusing an
              existing name overwrites it.
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={saveInputRef}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmSave();
              else if (e.key === "Escape") setSaveOpen(false);
            }}
            placeholder="preset name"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveOpen(false)}>
              cancel
            </Button>
            <Button size="sm" onClick={confirmSave} disabled={!saveName.trim()}>
              save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paste-fallback dialog (shows when navigator.clipboard.readText
          isn't available — e.g. non-secure contexts or denied permission). */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Paste stack</DialogTitle>
            <DialogDescription>
              Your browser blocked clipboard access. Paste the pressroom
              stack payload below.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="paste here…"
            rows={6}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPasteOpen(false)}>
              cancel
            </Button>
            <Button size="sm" onClick={confirmPaste} disabled={!pasteText.trim()}>
              apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
