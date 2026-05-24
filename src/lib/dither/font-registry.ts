// Pressroom font registry — used by the Text effect.
//
// Built-in fonts (Mondwest / Neue Bit / Geist Pixel) already get an
// @font-face declaration via styles.css, so the document and the live
// preview can render them out of the box. The worker, however, runs in a
// separate context with its own `self.fonts` set, so we have to load the
// font bytes there too before OffscreenCanvas can draw with them.
//
// Local fonts come from window.queryLocalFonts() (Chrome / Edge / other
// Chromium). When the user picks one, we fetch its bytes, register the
// FontFace against the document so the live preview can use it, AND ship
// the bytes to the worker so OffscreenCanvas in the worker can use it too.

export type FontSource = "built-in" | "local";

export type FontEntry = {
  family: string;
  source: FontSource;
  // Populated lazily for local fonts; built-ins resolve to the URL we
  // already know about.
  postscriptName?: string;
  // Tracks whether the worker already has this font registered. Avoids
  // shipping bytes more than once.
  workerLoaded: boolean;
};

const registry = new Map<string, FontEntry>();
const listeners = new Set<() => void>();
let snapshotCache: FontEntry[] | null = null;

// Pluggable hook: the worker registration handler. Wired by pipeline.ts
// when it creates the worker. If unset (e.g. before the first render), we
// fall back to fetching+registering against document.fonts only.
let workerRegisterFont:
  | ((family: string, bytes: ArrayBuffer) => Promise<void>)
  | null = null;

export function setWorkerFontRegistrar(
  fn: ((family: string, bytes: ArrayBuffer) => Promise<void>) | null,
) {
  workerRegisterFont = fn;
}

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
  { family: "Geist Pixel", url: "/font/GeistPixel-Square.woff2" },
];

let initStarted = false;
export async function initBuiltInFonts(): Promise<void> {
  if (initStarted) return;
  initStarted = true;
  for (const b of BUILT_INS) {
    if (!registry.has(b.family)) {
      registry.set(b.family, {
        family: b.family,
        source: "built-in",
        workerLoaded: false,
      });
    }
  }
  notify();
  // Eagerly ship each font's bytes to the worker so the Text effect can
  // start rendering with them on the first frame.
  await Promise.all(
    BUILT_INS.map(async (b) => {
      try {
        const buf = await fetch(b.url).then((r) => r.arrayBuffer());
        const reg = workerRegisterFont;
        if (reg) await reg(b.family, buf.slice(0));
        const entry = registry.get(b.family);
        if (entry) entry.workerLoaded = true;
      } catch (err) {
        console.warn("forge: built-in font fetch failed", b.family, err);
      }
    }),
  );
  notify();
}

// ---------- Local fonts ----------

type LocalFontData = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
  blob: () => Promise<Blob>;
};

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

export async function loadLocalFonts(): Promise<number> {
  if (!hasLocalFonts()) return 0;
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
      workerLoaded: false,
    });
    added += 1;
  }
  notify();
  return added;
}

// Lazily fetch a local font's bytes and register the FontFace with both
// document.fonts (so the live <canvas> preview text on the main thread
// uses the right glyphs) and the worker (so the OffscreenCanvas inside
// the pipeline does too).
export async function ensureFontLoaded(family: string): Promise<boolean> {
  const entry = registry.get(family);
  if (!entry) return false;
  if (entry.workerLoaded) return true;
  if (entry.source === "built-in") {
    // Built-ins are loaded eagerly in initBuiltInFonts; if we're here the
    // initial load is still in flight — just wait a tick. The slider will
    // re-render once the load resolves.
    return false;
  }
  if (!entry.postscriptName) return false;
  if (!hasLocalFonts()) return false;
  try {
    const matches = await (window as unknown as WindowWithLocalFonts).queryLocalFonts({
      postscriptNames: [entry.postscriptName],
    });
    if (matches.length === 0) return false;
    const blob = await matches[0].blob();
    const buf = await blob.arrayBuffer();
    // Inject @font-face on the document for live preview rendering.
    const url = URL.createObjectURL(blob);
    const style = document.createElement("style");
    style.textContent = `@font-face { font-family: "${entry.family.replace(/"/g, '\\"')}"; src: url(${url}); }`;
    document.head.appendChild(style);
    // Ship the bytes to the worker.
    const reg = workerRegisterFont;
    if (reg) await reg(entry.family, buf.slice(0));
    entry.workerLoaded = true;
    notify();
    return true;
  } catch (err) {
    console.warn("pressroom: ensureFontLoaded failed for", family, err);
    return false;
  }
}
