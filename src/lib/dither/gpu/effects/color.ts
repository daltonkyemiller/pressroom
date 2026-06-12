import type { ColorParams } from "../../effects/color/runtime";
import type { GpuEffect } from "../runner";

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_src;
uniform float u_cFactor;
uniform float u_brightness;
uniform float u_invGamma;
uniform float u_saturation;
uniform float u_temp;
uniform float u_tint;

void main() {
  vec4 c = texture2D(u_src, v_uv);
  vec3 col = c.rgb * 255.0;
  col = u_cFactor * (col + u_brightness - 128.0) + 128.0;
  col = pow(max(col, vec3(0.0)) / 255.0, vec3(u_invGamma)) * 255.0;
  // Temperature: positive shifts toward warm (R up, B down). Tint:
  // positive shifts toward magenta (R+B up, G down). Both run before
  // saturation so the saturation knob pulls toward the new neutral.
  col.r += u_temp + u_tint * 0.5;
  col.b += -u_temp + u_tint * 0.5;
  col.g += -u_tint;
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(L), col, u_saturation);
  gl_FragColor = vec4(clamp(col, 0.0, 255.0) / 255.0, c.a);
}
`;

export const colorGpu: GpuEffect<ColorParams> = {
  frag: FRAG,
  uniforms: [
    "u_cFactor",
    "u_brightness",
    "u_invGamma",
    "u_saturation",
    "u_temp",
    "u_tint",
  ],
  setUniforms: (gl, u, p) => {
    const c = p.contrast / 100;
    const cFactor = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));
    gl.uniform1f(u.u_cFactor, cFactor);
    gl.uniform1f(u.u_brightness, p.brightness);
    gl.uniform1f(u.u_invGamma, 1 / p.gamma);
    gl.uniform1f(u.u_saturation, p.saturation / 100);
    // Match CPU: ±100 on the slider → ±50 channel units.
    gl.uniform1f(u.u_temp, (p.temperature / 100) * 50);
    gl.uniform1f(u.u_tint, (p.tint / 100) * 50);
  },
};
