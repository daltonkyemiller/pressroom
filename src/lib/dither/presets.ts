// Effect-stack presets + clipboard payloads.
//
// Both flows ship the same shape: a versioned envelope holding the list of
// layers with their per-effect params, sans IDs. IDs get freshly minted
// when the preset/clipboard payload is loaded back into the live stack,
// so different invocations don't collide.
//
// localStorage key is namespaced with the schema version so a future
// breaking change doesn't crash on old data — old payloads simply won't
// match the version check and the user starts fresh.

import type { Layer } from "./effects";

const STORAGE_KEY = "pressroom.presets.v1";
const PAYLOAD_KIND = "pressroom.stack";
const PAYLOAD_VERSION = 1;

// A layer with its id stripped — id-less layers are portable across docs.
type PortableLayer = Omit<Layer, "id">;

export type StackPreset = {
  id: string;
  name: string;
  createdAt: number;
  layers: PortableLayer[];
};

// The envelope that goes into localStorage AND onto the clipboard.
type StackPayload = {
  kind: typeof PAYLOAD_KIND;
  version: number;
  layers: PortableLayer[];
};

function isPayload(value: unknown): value is StackPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.kind === PAYLOAD_KIND &&
    typeof v.version === "number" &&
    v.version === PAYLOAD_VERSION &&
    Array.isArray(v.layers)
  );
}

function stripIds(layers: readonly Layer[]): PortableLayer[] {
  return layers.map((l) => {
    const clone = structuredClone(l) as Partial<Layer> & { id?: number };
    delete clone.id;
    return clone as PortableLayer;
  });
}

function reattachIds(
  layers: readonly PortableLayer[],
  nextId: () => number,
): Layer[] {
  return layers.map(
    (l) => ({ ...structuredClone(l), id: nextId() }) as Layer,
  );
}

// ---------- localStorage presets ----------

export function listPresets(): StackPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Sort newest first so the dropdown puts the most recent saves on top.
    return [...parsed].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch {
    return [];
  }
}

function writePresets(presets: StackPreset[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    console.warn("pressroom: failed to write presets to localStorage", err);
  }
}

export function savePreset(name: string, layers: readonly Layer[]): StackPreset {
  const preset: StackPreset = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Untitled",
    createdAt: Date.now(),
    layers: stripIds(layers),
  };
  const all = listPresets();
  // Replace any existing preset with the same name so renaming-as-save
  // doesn't accumulate dupes.
  const filtered = all.filter((p) => p.name !== preset.name);
  writePresets([preset, ...filtered]);
  return preset;
}

export function deletePreset(id: string): void {
  writePresets(listPresets().filter((p) => p.id !== id));
}

export function loadPresetLayers(
  preset: StackPreset,
  nextId: () => number,
): Layer[] {
  return reattachIds(preset.layers, nextId);
}

// ---------- Clipboard ----------

function serialize(layers: readonly Layer[]): string {
  const payload: StackPayload = {
    kind: PAYLOAD_KIND,
    version: PAYLOAD_VERSION,
    layers: stripIds(layers),
  };
  return JSON.stringify(payload, null, 2);
}

export async function copyStackToClipboard(
  layers: readonly Layer[],
): Promise<void> {
  const text = serialize(layers);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for non-secure-context environments. Should be rare on the
  // domains we ship to but keeps the affordance from silently no-oping.
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
}

// Parses a string (clipboard or pasted text) into layers if it looks like
// a stack payload. Returns null for anything else so the caller can show
// the user a "that clipboard isn't a pressroom stack" message instead of
// silently doing nothing.
export function parseStackPayload(
  text: string,
  nextId: () => number,
): Layer[] | null {
  try {
    const parsed = JSON.parse(text);
    if (!isPayload(parsed)) return null;
    return reattachIds(parsed.layers, nextId);
  } catch {
    return null;
  }
}
