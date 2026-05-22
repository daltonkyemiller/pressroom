import { applyLayer, type Layer } from "./effects";

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

export function renderPipeline(
  source: CanvasImageSource & { width: number; height: number },
  layers: readonly Layer[],
  maxDim: number,
): RenderResult {
  const { width, height } = computeWorkDims(source, maxDim);
  const work = document.createElement("canvas");
  work.width = width;
  work.height = height;
  const wctx = work.getContext("2d", { willReadFrequently: true })!;
  wctx.imageSmoothingEnabled = true;
  wctx.imageSmoothingQuality = "high";
  wctx.drawImage(source, 0, 0, width, height);

  let imgData = wctx.getImageData(0, 0, width, height);
  for (const layer of layers) {
    if (!layer.enabled) continue;
    imgData = applyLayer(imgData, layer);
  }
  return { imgData, width, height };
}

export function exportPNG(
  source: CanvasImageSource & { width: number; height: number },
  layers: readonly Layer[],
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const { imgData, width, height } = renderPipeline(source, layers, Infinity);
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    out.getContext("2d")!.putImageData(imgData, 0, 0);
    out.toBlob(resolve, "image/png");
  });
}
