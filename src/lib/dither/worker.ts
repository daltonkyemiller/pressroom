/// <reference lib="webworker" />
import { runStack, type Layer } from "./effects";

type RenderRequest = {
  kind: "render";
  id: number;
  buffer: ArrayBufferLike;
  width: number;
  height: number;
  layers: readonly Layer[];
};

type RegisterFontRequest = {
  kind: "registerFont";
  id: number;
  family: string;
  // ArrayBuffer with the font file bytes. Comes in via the postMessage
  // transfer list so the main thread's copy is gone after the send.
  bytes: ArrayBuffer;
};

type WorkerRequest = RenderRequest | RegisterFontRequest;

const workerSelf = self as unknown as Worker & {
  fonts: FontFaceSet;
};

async function registerFont(family: string, bytes: ArrayBuffer): Promise<void> {
  // Quote the family to handle multi-word names; CSS shorthand parses it
  // correctly that way too.
  const face = new FontFace(family, bytes);
  await face.load();
  workerSelf.fonts.add(face);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.kind === "registerFont") {
    try {
      await registerFont(msg.family, msg.bytes);
      workerSelf.postMessage({ id: msg.id, ok: true, kind: "registerFont" });
    } catch (err) {
      workerSelf.postMessage({
        id: msg.id,
        ok: false,
        kind: "registerFont",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }
  // Render request.
  try {
    const input = new ImageData(
      new Uint8ClampedArray(msg.buffer as ArrayBuffer),
      msg.width,
      msg.height,
    );
    const img = runStack(input, msg.layers);
    const outBuf = img.data.buffer;
    workerSelf.postMessage(
      {
        id: msg.id,
        ok: true,
        kind: "render",
        buffer: outBuf,
        width: img.width,
        height: img.height,
      },
      [outBuf],
    );
  } catch (err) {
    workerSelf.postMessage({
      id: msg.id,
      ok: false,
      kind: "render",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
