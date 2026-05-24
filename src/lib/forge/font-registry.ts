// Runtime font registry for the forge tool. Holds:
//   1. Built-in fonts shipped from /public/font — preloaded as soon as
//      forge mounts so the default text primitive renders and booleans
//      against text work without ceremony.
//   2. Fonts the user pulls in via window.queryLocalFonts() — only listed
//      until first use, then their bytes are fetched on demand, parsed
//      with opentype.js, and an @font-face is injected so the rendered
//      <text> uses the right glyphs.
//
// Components can subscribe() to re-render whenever a font becomes ready.
// Everything is keyed by font-family (the CSS value), which is also what
// gets stored on the text primitive's `font` field.

import opentype from "opentype.js";

export type FontSource = "built-in" | "local";

export type FontEntry = {
  family: string; // CSS font-family value, used as the registry key
  source: FontSource;
  // Parsed opentype representation. null while loading; remains null if
  // parsing fails (e.g. WOFF2 — opentype.js doesn't handle WOFF2).
  font: opentype.Font | null;
  // For local fonts, used to refetch the blob lazily via queryLocalFonts.
  postscriptName?: string;
  // Whether the @font-face has already been injected for display rendering.
  faceInjected?: boolean;
};

const registry = new Map<string, FontEntry>();
const listeners = new Set<() => void>();

// Cached snapshot for useSyncExternalStore consumers. React requires
// getSnapshot to return the same reference between notifies, otherwise it
// thinks state changed every render and loops. We invalidate on notify
// and rebuild on demand.
let snapshotCache: FontEntry[] | null = null;

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

export function getFontEntry(family: string): FontEntry | undefined {
  return registry.get(family);
}

export function listFonts(): FontEntry[] {
  if (snapshotCache === null) {
    snapshotCache = Array.from(registry.values()).sort((a, b) =>
      a.family.localeCompare(b.family),
    );
  }
  return snapshotCache;
}

// ---------- Built-ins ----------

const BUILT_INS: Array<{ family: string; url: string }> = [
  { family: "Mondwest", url: "/font/ppmondwest-regular.otf" },
  { family: "Neue Bit", url: "/font/ppneuebit-bold.otf" },
  // Geist Pixel files are WOFF2; opentype.js can't parse them so they're
  // listed but won't boolean. Display-only is fine — the @font-face is
  // already in styles.css.
  { family: "Geist Pixel", url: "/font/GeistPixel-Square.woff2" },
];

let initStarted = false;
export async function initBuiltInFonts(): Promise<void> {
  if (initStarted) return;
  initStarted = true;
  // Register all entries upfront so the font picker sees them immediately.
  for (const b of BUILT_INS) {
    if (!registry.has(b.family)) {
      registry.set(b.family, {
        family: b.family,
        source: "built-in",
        font: null,
        faceInjected: true, // already in styles.css
      });
    }
  }
  notify();
  await Promise.all(
    BUILT_INS.map(async (b) => {
      try {
        const buf = await fetch(b.url).then((r) => r.arrayBuffer());
        const font = opentype.parse(buf);
        const entry = registry.get(b.family);
        if (entry) entry.font = font;
      } catch {
        // WOFF2 / network error — entry stays with font=null and just won't
        // participate in booleans. Display still works because the
        // @font-face was injected via the CSS already.
      }
    }),
  );
  notify();
}

// ---------- Local fonts (queryLocalFonts API) ----------

type LocalFontData = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob: () => Promise<Blob>;
};

// Has to be called as a method on window — detaching it into a local
// reference loses `this` and the call silently no-ops (or throws
// "Illegal invocation" depending on the build).
type WindowWithLocalFonts = Window & {
  queryLocalFonts: (options?: {
    postscriptNames?: string[];
  }) => Promise<LocalFontData[]>;
};

function hasLocalFonts(): boolean {
  return typeof window !== "undefined" && "queryLocalFonts" in window;
}

export function isLocalFontsSupported(): boolean {
  return hasLocalFonts();
}

// Asks the browser for the list of system fonts. Throws "NotAllowedError"
// if the user denied permission. Adds one entry per family — multiple
// faces of the same family get collapsed.
export async function loadLocalFonts(): Promise<number> {
  if (!hasLocalFonts()) return 0;
  const fonts = await (window as unknown as WindowWithLocalFonts).queryLocalFonts();
  let added = 0;
  const seenFamilies = new Set<string>();
  for (const fd of fonts) {
    if (seenFamilies.has(fd.family)) continue;
    seenFamilies.add(fd.family);
    if (registry.has(fd.family)) continue;
    registry.set(fd.family, {
      family: fd.family,
      source: "local",
      font: null,
      postscriptName: fd.postscriptName,
    });
    added += 1;
  }
  notify();
  return added;
}

// Lazy-load the actual font data for a local font. Called when:
//   - The font is selected for a text primitive (so display + booleans work)
//   - A boolean operation needs glyph outlines
// Re-entry is safe: returns the cached font if already loaded.
export async function ensureFontLoaded(
  family: string,
): Promise<opentype.Font | null> {
  const entry = registry.get(family);
  if (!entry) return null;
  if (entry.font) return entry.font;
  if (entry.source !== "local" || !entry.postscriptName) return null;
  if (!hasLocalFonts()) return null;
  try {
    const matches = await (window as unknown as WindowWithLocalFonts).queryLocalFonts({
      postscriptNames: [entry.postscriptName],
    });
    if (matches.length === 0) return null;
    const blob = await matches[0].blob();
    const buf = await blob.arrayBuffer();
    const font = opentype.parse(buf);
    entry.font = font;
    if (!entry.faceInjected) {
      const url = URL.createObjectURL(blob);
      const style = document.createElement("style");
      style.textContent = `@font-face { font-family: "${entry.family.replace(/"/g, "\\\"")}"; src: url(${url}); }`;
      document.head.appendChild(style);
      entry.faceInjected = true;
    }
    notify();
    return font;
  } catch (err) {
    console.warn("forge: ensureFontLoaded failed for", family, err);
    return null;
  }
}
