// Small WebGL runner that batches consecutive GPU effects on ping-pong FBOs.
// Each effect declares a fragment shader, a list of uniforms, and a binder
// function. The runner handles texture upload, program caching, FBO ping-pong,
// and readback into ImageData. Works on both the main thread and inside a
// worker via OffscreenCanvas.
//
// Coordinate convention: ImageData is top-down. WebGL textures use a bottom-up
// origin, but with UNPACK_FLIP_Y_WEBGL=false the upload preserves byte order,
// and readPixels reads framebuffer-order (bottom-up), so the two flips cancel:
// the round-trip is top-down → top-down without any manual row flipping.

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export type GpuUniformMap = Record<string, WebGLUniformLocation | null>;

export type GpuEffect<P> = {
  // Fragment shader source. The runner makes these uniforms / varyings
  // available implicitly:
  //   varying vec2 v_uv;
  //   uniform sampler2D u_src;
  //   uniform vec2 u_resolution;
  frag: string;
  // Names of any *extra* uniforms the shader declares. The runner resolves
  // their locations once per program compile.
  uniforms: readonly string[];
  // Bind effect-specific uniforms for this draw. u_src + u_resolution are
  // already set; aux textures (if any) are already bound to TEXTURE1..N.
  setUniforms: (
    gl: WebGLRenderingContext,
    u: GpuUniformMap,
    params: P,
    width: number,
    height: number,
  ) => void;
  // Optional: create persistent aux textures (e.g. a LUT). Called once on
  // first use of this effect's program. Returned textures are bound to
  // TEXTURE1..N for every draw, in order.
  initAux?: (gl: WebGLRenderingContext) => WebGLTexture[];
  // Optional: refresh aux textures' contents before each draw.
  updateAux?: (gl: WebGLRenderingContext, aux: WebGLTexture[], params: P) => void;
};

type ProgramEntry = {
  program: WebGLProgram;
  uniforms: GpuUniformMap;
  posLoc: number;
  aux: WebGLTexture[];
};

type Pingpong = {
  width: number;
  height: number;
  textures: [WebGLTexture, WebGLTexture];
  fbos: [WebGLFramebuffer, WebGLFramebuffer];
};

let canvas: OffscreenCanvas | null = null;
let gl: WebGLRenderingContext | null = null;
let posBuffer: WebGLBuffer | null = null;
let pingpong: Pingpong | null = null;
let initFailed = false;
const programs = new Map<string, ProgramEntry>();

function tryInit(): WebGLRenderingContext | null {
  if (gl) return gl;
  if (initFailed) return null;
  try {
    canvas = new OffscreenCanvas(1, 1);
    const g = canvas.getContext("webgl", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGLRenderingContext | null;
    if (!g) {
      initFailed = true;
      return null;
    }
    posBuffer = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, posBuffer);
    g.bufferData(
      g.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      g.STATIC_DRAW,
    );
    gl = g;
    return g;
  } catch {
    initFailed = true;
    return null;
  }
}

export function isGpuAvailable(): boolean {
  return tryInit() !== null;
}

function compileShader(g: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = g.createShader(type);
  if (!sh) throw new Error("createShader failed");
  g.shaderSource(sh, src);
  g.compileShader(sh);
  if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) {
    const info = g.getShaderInfoLog(sh);
    g.deleteShader(sh);
    throw new Error("shader compile failed: " + info);
  }
  return sh;
}

function getProgramFor<P>(g: WebGLRenderingContext, effect: GpuEffect<P>): ProgramEntry {
  const cached = programs.get(effect.frag);
  if (cached) return cached;
  const vs = compileShader(g, g.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(g, g.FRAGMENT_SHADER, effect.frag);
  const program = g.createProgram();
  if (!program) throw new Error("createProgram failed");
  g.attachShader(program, vs);
  g.attachShader(program, fs);
  g.linkProgram(program);
  if (!g.getProgramParameter(program, g.LINK_STATUS)) {
    throw new Error("link failed: " + g.getProgramInfoLog(program));
  }
  const uniforms: GpuUniformMap = {};
  const allNames = ["u_src", "u_resolution", ...effect.uniforms];
  for (const name of allNames) uniforms[name] = g.getUniformLocation(program, name);
  // Also resolve aux sampler uniforms (u_aux0, u_aux1, ...) if declared.
  const auxTextures = effect.initAux ? effect.initAux(g) : [];
  for (let i = 0; i < auxTextures.length; i++) {
    const name = `u_aux${i}`;
    uniforms[name] = g.getUniformLocation(program, name);
  }
  const posLoc = g.getAttribLocation(program, "a_position");
  const entry: ProgramEntry = { program, uniforms, posLoc, aux: auxTextures };
  programs.set(effect.frag, entry);
  return entry;
}

function makeColorTexture(g: WebGLRenderingContext, w: number, h: number): WebGLTexture {
  const tex = g.createTexture();
  if (!tex) throw new Error("createTexture failed");
  g.bindTexture(g.TEXTURE_2D, tex);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
  return tex;
}

function ensurePingpong(g: WebGLRenderingContext, w: number, h: number): Pingpong {
  if (pingpong && pingpong.width === w && pingpong.height === h) return pingpong;
  if (pingpong) {
    for (const t of pingpong.textures) g.deleteTexture(t);
    for (const f of pingpong.fbos) g.deleteFramebuffer(f);
  }
  const tex0 = makeColorTexture(g, w, h);
  const tex1 = makeColorTexture(g, w, h);
  const fbo0 = g.createFramebuffer();
  const fbo1 = g.createFramebuffer();
  if (!fbo0 || !fbo1) throw new Error("createFramebuffer failed");
  g.bindFramebuffer(g.FRAMEBUFFER, fbo0);
  g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex0, 0);
  g.bindFramebuffer(g.FRAMEBUFFER, fbo1);
  g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex1, 0);
  pingpong = { width: w, height: h, textures: [tex0, tex1], fbos: [fbo0, fbo1] };
  return pingpong;
}

export type GpuChainItem = { effect: GpuEffect<unknown>; params: unknown };

export function runGpuChain(img: ImageData, chain: readonly GpuChainItem[]): ImageData {
  if (chain.length === 0) return img;
  const g = tryInit();
  if (!g) throw new Error("WebGL unavailable");
  const w = img.width;
  const h = img.height;
  const pp = ensurePingpong(g, w, h);
  canvas!.width = w;
  canvas!.height = h;
  g.viewport(0, 0, w, h);

  // Upload source into texture 0 (the first "read" side).
  g.activeTexture(g.TEXTURE0);
  g.bindTexture(g.TEXTURE_2D, pp.textures[0]);
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
  g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);

  let readIdx = 0;
  let writeIdx = 1;

  for (let i = 0; i < chain.length; i++) {
    const { effect, params } = chain[i];
    const entry = getProgramFor(g, effect);
    g.useProgram(entry.program);
    g.bindFramebuffer(g.FRAMEBUFFER, pp.fbos[writeIdx]);

    // updateAux often calls gl.bindTexture without first switching the
    // active unit, so it would silently bind its aux texture to whatever
    // unit is currently active (most recently TEXTURE0, i.e. u_src). Park
    // the active unit on a high index first so updateAux can mutate its
    // aux without clobbering u_src.
    if (effect.updateAux && entry.aux.length > 0) {
      g.activeTexture(g.TEXTURE0 + 15);
      effect.updateAux(g, entry.aux, params);
    }

    // Bind aux textures to units 1..N for the shader.
    for (let j = 0; j < entry.aux.length; j++) {
      g.activeTexture(g.TEXTURE1 + j);
      g.bindTexture(g.TEXTURE_2D, entry.aux[j]);
      g.uniform1i(entry.uniforms[`u_aux${j}`], 1 + j);
    }

    // Bind source LAST so unit 0 = u_src no matter what updateAux did.
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, pp.textures[readIdx]);
    g.uniform1i(entry.uniforms.u_src, 0);
    g.uniform2f(entry.uniforms.u_resolution, w, h);

    effect.setUniforms(g, entry.uniforms, params, w, h);

    g.bindBuffer(g.ARRAY_BUFFER, posBuffer);
    g.enableVertexAttribArray(entry.posLoc);
    g.vertexAttribPointer(entry.posLoc, 2, g.FLOAT, false, 0, 0);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);

    readIdx ^= 1;
    writeIdx ^= 1;
  }

  // Read back from the most recently written FBO.
  g.bindFramebuffer(g.FRAMEBUFFER, pp.fbos[readIdx]);
  const pixels = new Uint8ClampedArray(w * h * 4);
  g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, pixels);
  return new ImageData(pixels, w, h);
}
