import { buildLUT, type CurvesParams } from "../../curves";
import type { GpuEffect } from "../runner";

// One 256×1 RGBA LUT packs all four curves:
//   R = rgb-curve, G = r-curve, B = g-curve, A = b-curve.
// Shader applies rgb first, then per-channel curves (matching the CPU order).
const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_src;
uniform sampler2D u_aux0;

vec2 lutUv(float x) {
  return vec2((x * 255.0 + 0.5) / 256.0, 0.5);
}

void main() {
  vec4 c = texture2D(u_src, v_uv);
  float r = texture2D(u_aux0, lutUv(c.r)).r;
  float g = texture2D(u_aux0, lutUv(c.g)).r;
  float b = texture2D(u_aux0, lutUv(c.b)).r;
  r = texture2D(u_aux0, lutUv(r)).g;
  g = texture2D(u_aux0, lutUv(g)).b;
  b = texture2D(u_aux0, lutUv(b)).a;
  gl_FragColor = vec4(r, g, b, c.a);
}
`;

function packLUT(p: CurvesParams): Uint8Array {
  const rgb = buildLUT(p.rgb);
  const r = buildLUT(p.r);
  const g = buildLUT(p.g);
  const b = buildLUT(p.b);
  const out = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    out[i * 4] = rgb[i];
    out[i * 4 + 1] = r[i];
    out[i * 4 + 2] = g[i];
    out[i * 4 + 3] = b[i];
  }
  return out;
}

export const curvesGpu: GpuEffect<CurvesParams> = {
  frag: FRAG,
  uniforms: [],
  initAux: (gl) => {
    const tex = gl.createTexture();
    if (!tex) throw new Error("createTexture failed");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(256 * 4),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return [tex];
  },
  updateAux: (gl, aux, p) => {
    gl.bindTexture(gl.TEXTURE_2D, aux[0]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, packLUT(p));
  },
  setUniforms: () => {
    // u_aux0 sampler binding is handled by the runner.
  },
};
