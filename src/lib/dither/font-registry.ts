// Pressroom's Text-effect font surface — a thin layer over the shared
// font registry (`src/lib/fonts/registry.ts`, see ADR-0002). The shared
// module owns discovery (queryLocalFonts + dedup), the family list,
// React subscribe / snapshot, and the bytes cache. This file adds the
// pressroom-specific piece: shipping the bytes to the dither worker via
// the `setWorkerFontRegistrar` hook so OffscreenCanvas in the worker
// can render with them.

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

// Pressroom callers used to read `entry.workerLoaded` and `source`. Keep
// the shape they expect — listFonts() is just the shared list (no new
// data).
export type FontEntry = SharedFontEntry & {
  workerLoaded: boolean;
};

// Per-family worker-loaded tracker. Internal to this module — the shared
// registry doesn't need to know whether each tool has shipped its bytes
// somewhere.
const workerLoaded = new Set<string>();

// Local snapshot cache. The shared registry caches its own snapshot, but
// our wrapper `.map()`s a new array on every call — without a local
// cache, useSyncExternalStore sees a fresh reference each render and
// loops infinitely. We rebuild only when the shared list changes
// (reference compare) or our local state changes (`notifyLocal()`).
let cachedList: FontEntry[] | null = null;
let cachedSharedRef: SharedFontEntry[] | null = null;
// Forward both shared and local notifications to React subscribers so
// changes to either side trigger a re-render.
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
    workerLoaded: workerLoaded.has(e.family),
  }));
  return cachedList;
}

let workerRegisterFont:
  | ((family: string, bytes: ArrayBuffer) => Promise<void>)
  | null = null;

export function setWorkerFontRegistrar(
  fn: ((family: string, bytes: ArrayBuffer) => Promise<void>) | null,
) {
  workerRegisterFont = fn;
}

const BUILT_INS: Array<{ family: string; url: string }> = [
  { family: "Mondwest", url: "/font/ppmondwest-regular.otf" },
  { family: "Neue Bit", url: "/font/ppneuebit-bold.otf" },
  { family: "Geist Pixel", url: "/font/GeistPixel-Square.woff2" },
];

let initStarted = false;
export async function initBuiltInFonts(): Promise<void> {
  if (initStarted) return;
  initStarted = true;
  for (const b of BUILT_INS) registerBuiltIn(b.family, b.url);
  // Eagerly ship each built-in's bytes to the worker so the Text effect
  // can start rendering on the first frame.
  await Promise.all(
    BUILT_INS.map(async (b) => {
      try {
        const cached = await getFontBytes(b.family);
        if (!cached) return;
        const reg = workerRegisterFont;
        if (reg) await reg(b.family, cached.buffer.slice(0));
        workerLoaded.add(b.family);
        notifyLocal();
      } catch (err) {
        console.warn("pressroom: built-in font ship failed", b.family, err);
      }
    }),
  );
}

// Lazily fetch a font's bytes, inject an @font-face for the live preview,
// and ship the bytes to the worker so OffscreenCanvas in the pipeline can
// render with them.
export async function ensureFontLoaded(family: string): Promise<boolean> {
  if (workerLoaded.has(family)) return true;
  const cached = await getFontBytes(family);
  if (!cached) return false;
  // Inject @font-face on the document for live preview rendering. Only
  // needed for local fonts — built-ins already have an @font-face in
  // styles.css.
  if (typeof document !== "undefined") {
    const url = URL.createObjectURL(cached.blob);
    const style = document.createElement("style");
    style.textContent = `@font-face { font-family: "${family.replace(/"/g, '\\"')}"; src: url(${url}); }`;
    document.head.appendChild(style);
  }
  const reg = workerRegisterFont;
  if (reg) await reg(family, cached.buffer.slice(0));
  workerLoaded.add(family);
  notifyLocal();
  return true;
}
