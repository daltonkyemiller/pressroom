import { runStack, type Layer } from "./effects";
import { setWorkerFontRegistrar } from "./font-registry";

export type RenderResult = {
  imgData: ImageData;
  width: number;
  height: number;
};

export function computeWorkDims(
  source: { width: number; height: number },
  maxDim: number,
): { width: number; height: number } {
  const ratio = source.width / source.height;
  if (source.width >= source.height) {
    const w = Math.min(source.width, maxDim);
    return { width: w, height: Math.round(w / ratio) };
  }
  const h = Math.min(source.height, maxDim);
  return { width: Math.round(h * ratio), height: h };
}

// Rasterize the source HTMLImageElement → ImageData at working resolution.
// Lives on the main thread because workers can't accept DOM image elements.
function rasterize(
  source: CanvasImageSource & { width: number; height: number },
  maxDim: number,
): { imgData: ImageData; width: number; height: number } {
  const { width, height } = computeWorkDims(source, maxDim);
  const work = new OffscreenCanvas(width, height);
  const ctx = work.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return { imgData: ctx.getImageData(0, 0, width, height), width, height };
}

// Synchronous path, used by export and as a fallback.
export function renderPipeline(
  source: CanvasImageSource & { width: number; height: number },
  layers: readonly Layer[],
  maxDim: number,
): RenderResult {
  const { imgData: initial, width, height } = rasterize(source, maxDim);
  const imgData = runStack(initial, layers);
  return { imgData, width, height };
}

// ---------- Worker-backed async path ----------

type RenderResponse = {
  id: number;
  ok: boolean;
  kind: "render";
  buffer?: ArrayBufferLike;
  width?: number;
  height?: number;
  error?: string;
};
type FontRegisterResponse = {
  id: number;
  ok: boolean;
  kind: "registerFont";
  error?: string;
};
type WorkerResponse = RenderResponse | FontRegisterResponse;

let worker: Worker | null = null;
let nextId = 0;
const renderPending = new Map<
  number,
  { resolve: (r: RenderResult) => void; reject: (e: Error) => void }
>();
const fontPending = new Map<
  number,
  { resolve: () => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    if (msg.kind === "registerFont") {
      const p = fontPending.get(msg.id);
      if (!p) return;
      fontPending.delete(msg.id);
      if (msg.ok) p.resolve();
      else p.reject(new Error(msg.error || "font register failed"));
      return;
    }
    const p = renderPending.get(msg.id);
    if (!p) return;
    renderPending.delete(msg.id);
    if (!msg.ok || !msg.buffer || msg.width == null || msg.height == null) {
      p.reject(new Error(msg.error || "render failed"));
      return;
    }
    p.resolve({
      imgData: new ImageData(
        new Uint8ClampedArray(msg.buffer as ArrayBuffer),
        msg.width,
        msg.height,
      ),
      width: msg.width,
      height: msg.height,
    });
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || "worker error");
    for (const p of renderPending.values()) p.reject(err);
    for (const p of fontPending.values()) p.reject(err);
    renderPending.clear();
    fontPending.clear();
  };
  // Plug ourselves into the font registry so it can ship bytes here.
  setWorkerFontRegistrar((family, bytes) => {
    const id = nextId++;
    return new Promise<void>((resolve, reject) => {
      fontPending.set(id, { resolve, reject });
      worker!.postMessage(
        { kind: "registerFont", id, family, bytes },
        [bytes],
      );
    });
  });
  return worker;
}

export function renderPipelineAsync(
  source: CanvasImageSource & { width: number; height: number },
  layers: readonly Layer[],
  maxDim: number,
): Promise<RenderResult> {
  const { imgData, width, height } = rasterize(source, maxDim);
  const buffer = imgData.data.buffer;
  const id = nextId++;
  return new Promise<RenderResult>((resolve, reject) => {
    renderPending.set(id, { resolve, reject });
    getWorker().postMessage(
      { kind: "render", id, buffer, width, height, layers },
      [buffer],
    );
  });
}

export function exportPNG(
  source: CanvasImageSource & { width: number; height: number },
  layers: readonly Layer[],
  maxDim: number,
): Promise<Blob | null> {
  // Run the whole effect stack at the same working resolution as the
  // preview so the export is WYSIWYG. Resolution-dependent effects
  // (halftone dots, dither patterns, grain, edge bleed, displace) look
  // completely different at full source res than they do in the 900px
  // preview, so matching resolution is the only way to keep parity.
  // Then nearest-neighbor upscale to source dims so the exported file
  // keeps its original size — each effect-pixel becomes a clean block.
  const { imgData, width, height } = renderPipeline(source, layers, maxDim);
  const work = new OffscreenCanvas(width, height);
  work.getContext("2d")!.putImageData(imgData, 0, 0);

  const out = new OffscreenCanvas(source.width, source.height);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(work, 0, 0, source.width, source.height);
  return out.convertToBlob({ type: "image/png" }).catch(() => null);
}
