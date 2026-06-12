// Shared font discovery used by both pressroom and forge. See
// `docs/adr/0002-shared-font-discovery.md`.
//
// What lives here: the canonical Map of available fonts (family + source
// + postscript name), the subscribe/snapshot infrastructure for React
// useSyncExternalStore consumers, the `queryLocalFonts()` permission
// prompt + dedup, and a one-time bytes cache so a font's URL/blob is
// fetched at most once per session even when both tools want it.
//
// What does NOT live here: per-tool representations of the bytes. The
// Text effect ships bytes to a worker via FontFace; forge parses them
// with opentype.js. Each tool calls `getFontBytes(family)` and stashes
// its own representation in its own per-tool registry — the
// representation slot is intentionally not part of the shared entry.

export type FontSource = "built-in" | "local";

export type SharedFontEntry = {
  family: string; // CSS font-family value — registry key.
  source: FontSource;
  // For "built-in" fonts: URL the bytes can be fetched from.
  url?: string;
  // For "local" fonts: passed back to queryLocalFonts({ postscriptNames })
  // to re-fetch the blob on demand.
  postscriptName?: string;
};

type CachedBytes = { buffer: ArrayBuffer; blob: Blob };

const registry = new Map<string, SharedFontEntry>();
const bytesCache = new Map<string, CachedBytes>();
const inflight = new Map<string, Promise<CachedBytes | null>>();
const listeners = new Set<() => void>();

// Cached snapshot for useSyncExternalStore consumers. React requires
// getSnapshot to return the same reference between notifies, otherwise
// it thinks state changed every render and infinite-loops. We invalidate
// on notify and rebuild on demand.
let snapshotCache: SharedFontEntry[] | null = null;

function notify() {
  snapshotCache = null;
  for (const l of listeners) l();
}

export function subscribeFonts(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function listFonts(): SharedFontEntry[] {
  if (snapshotCache === null) {
    snapshotCache = Array.from(registry.values()).sort((a, b) =>
      a.family.localeCompare(b.family),
    );
  }
  return snapshotCache;
}

export function getFontEntry(family: string): SharedFontEntry | undefined {
  return registry.get(family);
}

type WindowWithLocalFonts = Window & {
  queryLocalFonts: (options?: {
    postscriptNames?: string[];
  }) => Promise<
    Array<{
      family: string;
      fullName: string;
      postscriptName: string;
      style: string;
      blob: () => Promise<Blob>;
    }>
  >;
};

function hasLocalFontsApi(): boolean {
  return typeof window !== "undefined" && "queryLocalFonts" in window;
}

export function isLocalFontsSupported(): boolean {
  return hasLocalFontsApi();
}

/** Idempotently add a built-in font (shipped from /public/font). Each
 *  tool calls this at startup for the fonts it cares about; if both
 *  tools register the same family + url, only the first one takes effect
 *  — bytes get fetched once and shared. */
export function registerBuiltIn(family: string, url: string): void {
  if (registry.has(family)) return;
  registry.set(family, { family, source: "built-in", url });
  notify();
}

/** Triggers the queryLocalFonts permission prompt (Chromium-only) and
 *  merges new families into the registry. Returns the count of fonts
 *  newly added (existing entries are left alone). Throws on
 *  NotAllowedError when the user denies the prompt. */
export async function loadLocalFonts(): Promise<number> {
  if (!hasLocalFontsApi()) return 0;
  const fonts = await (window as unknown as WindowWithLocalFonts).queryLocalFonts();
  let added = 0;
  const seen = new Set<string>();
  for (const fd of fonts) {
    if (seen.has(fd.family)) continue;
    seen.add(fd.family);
    if (registry.has(fd.family)) continue;
    registry.set(fd.family, {
      family: fd.family,
      source: "local",
      postscriptName: fd.postscriptName,
    });
    added += 1;
  }
  if (added > 0) notify();
  return added;
}

/** Fetch the font bytes for a registered family, caching them so a
 *  second consumer (the other tool) reuses the same buffer. Returns
 *  null if the family isn't registered, the source has no fetchable
 *  bytes, or the fetch fails. */
export async function getFontBytes(family: string): Promise<CachedBytes | null> {
  const cached = bytesCache.get(family);
  if (cached) return cached;
  const existing = inflight.get(family);
  if (existing) return existing;
  const entry = registry.get(family);
  if (!entry) return null;

  const promise = (async (): Promise<CachedBytes | null> => {
    try {
      if (entry.source === "built-in" && entry.url) {
        const resp = await fetch(entry.url);
        const blob = await resp.blob();
        const buffer = await blob.arrayBuffer();
        const result = { buffer, blob };
        bytesCache.set(family, result);
        return result;
      }
      if (entry.source === "local" && entry.postscriptName && hasLocalFontsApi()) {
        const matches = await (window as unknown as WindowWithLocalFonts).queryLocalFonts({
          postscriptNames: [entry.postscriptName],
        });
        if (matches.length === 0) return null;
        const blob = await matches[0].blob();
        const buffer = await blob.arrayBuffer();
        const result = { buffer, blob };
        bytesCache.set(family, result);
        return result;
      }
      return null;
    } catch (err) {
      console.warn("fonts: getFontBytes failed for", family, err);
      return null;
    } finally {
      inflight.delete(family);
    }
  })();

  inflight.set(family, promise);
  return promise;
}
