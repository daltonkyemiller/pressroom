// Duotone block shader — ported from dalton.computer
// (src/components/duotone-block-shader.tsx). The fragment shader is the same
// canvas-rendered look, simplified to a single-image static input (no fade,
// no pointer-tracking, no draw-rect cropping).

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_primary;
uniform vec2 u_resolution;
uniform vec3 u_backColor;
uniform vec3 u_dashColor;
uniform float u_backOpacity;
uniform float u_tile;
uniform float u_thickness;
uniform float u_lengthScale;
uniform float u_brightnessOffset;
uniform float u_blurRadius;
uniform int u_blurPasses;
uniform float u_contrast;
uniform float u_originalColors;
uniform float u_inverted;
uniform float u_gradientAlign;

float distSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
  return length(pa - ba * h);
}

vec4 sampleImage(vec2 logicalPx) {
  vec2 uv = logicalPx / u_resolution;
  float inBounds = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  return texture2D(u_primary, clamp(uv, 0.0, 1.0)) * inBounds;
}

vec4 blurredSample(vec2 logicalPx, float radius, int passes) {
  if (radius <= 0.001 || passes <= 0) {
    return sampleImage(logicalPx);
  }
  vec4 sum = sampleImage(logicalPx);
  float weightSum = 1.0;
  float invPasses = 1.0 / float(passes);
  for (int ring = 1; ring <= 3; ring++) {
    if (ring > passes) break;
    float t = float(ring) * invPasses;
    float r = t * radius;
    float rd = r * 0.7071;
    float wAxis = exp(-t * t * 2.5);
    float wDiag = exp(-t * t * 5.0);
    sum += sampleImage(logicalPx + vec2(r, 0.0)) * wAxis;
    sum += sampleImage(logicalPx + vec2(-r, 0.0)) * wAxis;
    sum += sampleImage(logicalPx + vec2(0.0, r)) * wAxis;
    sum += sampleImage(logicalPx + vec2(0.0, -r)) * wAxis;
    sum += sampleImage(logicalPx + vec2(rd, rd)) * wDiag;
    sum += sampleImage(logicalPx + vec2(-rd, rd)) * wDiag;
    sum += sampleImage(logicalPx + vec2(rd, -rd)) * wDiag;
    sum += sampleImage(logicalPx + vec2(-rd, -rd)) * wDiag;
    weightSum += 4.0 * wAxis + 4.0 * wDiag;
  }
  return sum / weightSum;
}

void main() {
  vec2 fragLogical = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);

  float tile = max(u_tile, 1.0);
  vec2 cellIndex = floor(fragLogical / tile);
  vec2 cellCenter = (cellIndex + 0.5) * tile;
  vec2 cellUv = fract(fragLogical / tile);

  vec4 sceneSample = blurredSample(cellCenter, u_blurRadius, u_blurPasses);

  vec3 contrastColor = clamp((sceneSample.rgb - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float mask = smoothstep(0.02, 0.08, sceneSample.a);

  float brightness = (contrastColor.r + contrastColor.g + contrastColor.b) / 3.0;
  brightness = mix(brightness, 1.0 - brightness, step(0.5, u_inverted));

  float bandRadius = clamp(brightness + u_brightnessOffset, 0.0, 1.0) * u_lengthScale;

  vec2 capsuleAxis = vec2(1.0, 0.0);
  if (u_gradientAlign > 0.001 && bandRadius > 0.0001) {
    vec4 sL = sampleImage(cellCenter + vec2(-tile, 0.0));
    vec4 sR = sampleImage(cellCenter + vec2(tile, 0.0));
    vec4 sU = sampleImage(cellCenter + vec2(0.0, -tile));
    vec4 sD = sampleImage(cellCenter + vec2(0.0, tile));
    float bL = (sL.r + sL.g + sL.b) / 3.0;
    float bR = (sR.r + sR.g + sR.b) / 3.0;
    float bU = (sU.r + sU.g + sU.b) / 3.0;
    float bD = (sD.r + sD.g + sD.b) / 3.0;
    vec2 gradient = vec2(bR - bL, bD - bU);
    float gradMag = length(gradient);
    if (gradMag > 0.001) {
      float angle = atan(gradient.y, gradient.x) + 1.5707963;
      angle = mod(angle + 1.5707963, 3.1415927) - 1.5707963;
      float align = smoothstep(0.05, 0.4, gradMag) * u_gradientAlign;
      float finalAngle = angle * align;
      capsuleAxis = vec2(cos(finalAngle), sin(finalAngle));
    }
  }

  float alpha = 0.0;
  if (bandRadius > 0.0001) {
    vec2 center = vec2(0.5);
    vec2 a = center - capsuleAxis * bandRadius;
    vec2 b = center + capsuleAxis * bandRadius;
    float d = distSegment(cellUv, a, b) - u_thickness * bandRadius;
    alpha = (1.0 - smoothstep(0.0, 0.02, d)) * mask;
  }

  vec3 backColor = u_backColor / 255.0;
  vec3 dashColor = u_dashColor / 255.0;
  vec3 sourceColor = mix(dashColor, contrastColor, step(0.5, u_originalColors));

  vec3 finalColor = mix(backColor, sourceColor, alpha);
  float finalAlpha = max(u_backOpacity, alpha);
  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

export type DuotoneParams = {
  tile: number;
  thickness: number;
  lengthScale: number;
  brightnessOffset: number;
  blurRadius: number;
  blurPasses: number;
  contrast: number;
  gradientAlign: number;
  originalColors: boolean;
  inverted: boolean;
  dashColor: string;
  backColor: string;
  backOpacity: number;
};

export const DUOTONE_DEFAULTS: DuotoneParams = {
  tile: 14,
  thickness: 0.18,
  lengthScale: 0.45,
  brightnessOffset: 0,
  blurRadius: 0,
  blurPasses: 0,
  contrast: 1.1,
  gradientAlign: 0,
  originalColors: true,
  inverted: false,
  dashColor: "#0a0a0a",
  backColor: "#efece6",
  backOpacity: 1,
};

type Runtime = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
  posBuffer: WebGLBuffer;
  uniforms: Record<string, WebGLUniformLocation | null>;
  posLoc: number;
};

let runtime: Runtime | null = null;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("shader compile failed: " + info);
  }
  return shader;
}

function getRuntime(): Runtime {
  if (runtime) return runtime;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL not supported");
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error("link failed: " + info);
  }
  gl.useProgram(program);

  const posBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const posLoc = gl.getAttribLocation(program, "a_position");

  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uniformNames = [
    "u_primary",
    "u_resolution",
    "u_backColor",
    "u_dashColor",
    "u_backOpacity",
    "u_tile",
    "u_thickness",
    "u_lengthScale",
    "u_brightnessOffset",
    "u_blurRadius",
    "u_blurPasses",
    "u_contrast",
    "u_originalColors",
    "u_inverted",
    "u_gradientAlign",
  ];
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);

  runtime = { canvas, gl, program, texture, posBuffer, uniforms, posLoc };
  return runtime;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function applyDuotoneShader(img: ImageData, p: DuotoneParams): ImageData {
  const r = getRuntime();
  const { gl, canvas, program, texture, posBuffer, uniforms, posLoc } = r;
  const w = img.width;
  const h = img.height;
  canvas.width = w;
  canvas.height = h;
  gl.viewport(0, 0, w, h);
  gl.useProgram(program);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  const back = hexToRgb(p.backColor);
  const dash = hexToRgb(p.dashColor);
  gl.uniform1i(uniforms.u_primary, 0);
  gl.uniform2f(uniforms.u_resolution, w, h);
  gl.uniform3f(uniforms.u_backColor, back[0], back[1], back[2]);
  gl.uniform3f(uniforms.u_dashColor, dash[0], dash[1], dash[2]);
  gl.uniform1f(uniforms.u_backOpacity, p.backOpacity);
  gl.uniform1f(uniforms.u_tile, p.tile);
  gl.uniform1f(uniforms.u_thickness, p.thickness);
  gl.uniform1f(uniforms.u_lengthScale, p.lengthScale);
  gl.uniform1f(uniforms.u_brightnessOffset, p.brightnessOffset);
  gl.uniform1f(uniforms.u_blurRadius, p.blurRadius);
  gl.uniform1i(uniforms.u_blurPasses, p.blurPasses);
  gl.uniform1f(uniforms.u_contrast, p.contrast);
  gl.uniform1f(uniforms.u_originalColors, p.originalColors ? 1 : 0);
  gl.uniform1f(uniforms.u_inverted, p.inverted ? 1 : 0);
  gl.uniform1f(uniforms.u_gradientAlign, p.gradientAlign);

  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // readPixels reads bottom-up; flip rows so the resulting ImageData is top-down.
  const pixels = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const out = new Uint8ClampedArray(pixels.length);
  const rowBytes = w * 4;
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * rowBytes;
    const dst = y * rowBytes;
    for (let i = 0; i < rowBytes; i++) out[dst + i] = pixels[src + i];
  }
  return new ImageData(out, w, h);
}
