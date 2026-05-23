/// <reference lib="webworker" />
import { runStack, type Layer } from "./effects";

type RenderRequest = {
  id: number;
  buffer: ArrayBufferLike;
  width: number;
  height: number;
  layers: readonly Layer[];
};

self.onmessage = (e: MessageEvent<RenderRequest>) => {
  const { id, buffer, width, height, layers } = e.data;
  try {
    const input = new ImageData(
      new Uint8ClampedArray(buffer as ArrayBuffer),
      width,
      height,
    );
    const img = runStack(input, layers);
    const outBuf = img.data.buffer;
    (self as unknown as Worker).postMessage(
      { id, ok: true, buffer: outBuf, width: img.width, height: img.height },
      [outBuf],
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
