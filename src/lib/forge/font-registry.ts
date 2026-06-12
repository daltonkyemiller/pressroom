// Forge's text-primitive font surface — a thin layer over the shared
// font registry (`src/lib/fonts/registry.ts`, see ADR-0002). The shared
// module owns discovery (queryLocalFonts + dedup), the family list, the
// React subscribe / snapshot, and the bytes cache. This file adds the
// forge-specific piece: parsing the bytes with opentype.js so boolean
// modifiers can extract glyph outlines, and injecting an @font-face for
// the live SVG <text> rendering.

import opentype from "opentype.js";
import {
  getFontBytes,
  isLocalFontsSupported as sharedIsLocalFontsSupported,
  listFonts as sharedListFonts,
  loadLocalFonts as sharedLoadLocalFonts,
  registerBuiltIn,
  subscribeFonts as sharedSubscribeFonts,
  type SharedFontEntry,
} from "../fonts/registry";

export type { FontSource } from "../fonts/registry";

// boolean.ts and text/runtime.ts read `entry.font`; existing callers
// expect the parsed opentype representation on the entry.
export type FontEntry = SharedFontEntry & {
  font: opentype.Font | null;
  faceInjected: boolean;
};

const opentypeFonts = new Map<string, opentype.Font>();
const faceInjected = new Set<string>();

// Local snapshot cache. The shared listFonts() caches its own array,
// but our wrapper `.map()`s a new one per call — without a local cache,
// useSyncExternalStore sees a fresh reference each render and loops.
// We rebuild when the shared list changes (ref compare) or when local
// state changes (`notifyLocal()`).
let cachedList: FontEntry[] | null = null;
let cachedSharedRef: SharedFontEntry[] | null = null;
const localListeners = new Set<() => void>();

function notifyLocal() {
  cachedList = null;
  for (const l of localListeners) l();
}

export const isLocalFontsSupported = sharedIsLocalFontsSupported;
export const loadLocalFonts = sharedLoadLocalFonts;

export function subscribeFonts(cb: () => void): () => void {
  const unsubShared = sharedSubscribeFonts(cb);
  localListeners.add(cb);
  return () => {
    unsubShared();
    localListeners.delete(cb);
  };
}

export function listFonts(): FontEntry[] {
  const shared = sharedListFonts();
  if (cachedList !== null && shared === cachedSharedRef) return cachedList;
  cachedSharedRef = shared;
  cachedList = shared.map((e) => ({
    ...e,
    font: opentypeFonts.get(e.family) ?? null,
    faceInjected: faceInjected.has(e.family) || e.source === "built-in",
  }));
  return cachedList;
}

export function getFontEntry(family: string): FontEntry | undefined {
  return listFonts().find((e) => e.family === family);
}

const BUILT_INS: Array<{ family: string; url: string }> = [
  { family: "Mondwest", url: "/font/ppmondwest-regular.otf" },
  { family: "Neue Bit", url: "/font/ppneuebit-bold.otf" },
  // Geist Pixel is WOFF2; opentype.js can't parse it, so booleans
  // against it will no-op. Display still works because the @font-face
  // lives in styles.css.
  { family: "Geist Pixel", url: "/font/GeistPixel-Square.woff2" },
];

let initStarted = false;
export async function initBuiltInFonts(): Promise<void> {
  if (initStarted) return;
  initStarted = true;
  for (const b of BUILT_INS) registerBuiltIn(b.family, b.url);
  await Promise.all(
    BUILT_INS.map(async (b) => {
      try {
        const cached = await getFontBytes(b.family);
        if (!cached) return;
        const font = opentype.parse(cached.buffer);
        opentypeFonts.set(b.family, font);
        notifyLocal();
      } catch {
        // WOFF2 / network error — leave the entry with font=null; it
        // just won't participate in booleans. Display still works.
      }
    }),
  );
}

// Lazy-load the parsed opentype font for a registered family. Called
// when the text primitive's font is selected (for display) and when a
// boolean operation needs glyph outlines. Re-entry is safe.
export async function ensureFontLoaded(
  family: string,
): Promise<opentype.Font | null> {
  const cached = opentypeFonts.get(family);
  if (cached) return cached;
  const bytes = await getFontBytes(family);
  if (!bytes) return null;
  try {
    const font = opentype.parse(bytes.buffer);
    opentypeFonts.set(family, font);
    // Inject @font-face for live display rendering (local fonts only —
    // built-ins are already in styles.css).
    if (!faceInjected.has(family) && typeof document !== "undefined") {
      const url = URL.createObjectURL(bytes.blob);
      const style = document.createElement("style");
      style.textContent = `@font-face { font-family: "${family.replace(/"/g, '\\"')}"; src: url(${url}); }`;
      document.head.appendChild(style);
      faceInjected.add(family);
    }
    notifyLocal();
    return font;
  } catch (err) {
    console.warn("forge: ensureFontLoaded failed for", family, err);
    return null;
  }
}
