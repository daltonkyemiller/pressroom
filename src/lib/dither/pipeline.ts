import { runStack, type Layer } from "./effects";

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

type WorkerRequest = {
  id: number;
  buffer: ArrayBufferLike;
  width: number;
  height: number;
  layers: readonly Layer[];
};
type WorkerResponse =
  | { id: number; ok: true; buffer: ArrayBufferLike; width: number; height: number }
  | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (r: RenderResult) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (!msg.ok) {
      p.reject(new Error(msg.error));
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
    // Surface uncaught worker errors to all pending requests, then reset.
    const err = new Error(e.message || "worker error");
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };
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
    pending.set(id, { resolve, reject });
    const req: WorkerRequest = { id, buffer, width, height, layers };
    getWorker().postMessage(req, [buffer]);
  });
}

export function exportPNG(
  source: CanvasImageSource & { width: number; height: number },
  layers: readonly Layer[],
): Promise<Blob | null> {
  const { imgData, width, height } = renderPipeline(source, layers, Infinity);
  const out = new OffscreenCanvas(width, height);
  out.getContext("2d")!.putImageData(imgData, 0, 0);
  return out.convertToBlob({ type: "image/png" }).catch(() => null);
}
