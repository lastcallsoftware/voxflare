import type { AnimationState } from './animation';
import { ANGLE_SAMPLES, FIXED_CENTER_RADIUS, FULL_WARP_RADIUS, WARP_EXTENT, updateDisplacements } from './displacement';

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
uniform vec2 uScale;
out vec2 vPosition;
void main() {
  vPosition = vec2(aPosition.x, -aPosition.y) * ${WARP_EXTENT};
  gl_Position = vec4(aPosition * uScale, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uArtwork;
uniform sampler2D uDisplacements;
uniform float uAmplitude;
uniform float uWarpStrength;
uniform bool uPlasma;
uniform vec2 uInteriorTransform;
in vec2 vPosition;
out vec4 outColor;
void main() {
  float angle = atan(vPosition.y, vPosition.x);
  float sampleIndex = (angle + 3.14159265359) / 6.28318530718 * ${ANGLE_SAMPLES}.0;
  int bin = min(int(floor(sampleIndex)), ${ANGLE_SAMPLES - 1});
  float a = texelFetch(uDisplacements, ivec2(bin, 0), 0).r;
  float b = texelFetch(uDisplacements, ivec2(bin + 1, 0), 0).r;
  float displacement = mix(a, b, sampleIndex - float(bin));
  // Perimeter distortion leaves the center fixed and grows smoothly toward the artwork's edge.
  float weight = smoothstep(${FIXED_CENTER_RADIUS}, ${FULL_WARP_RADIUS}, length(vPosition));
  vec2 sourcePosition = vPosition / (1.0 + displacement * weight * uWarpStrength);
  // Fade the interior's inverse scale/rotation to identity before the outer corona.
  float interiorWeight = 1.0 - smoothstep(0.25, 0.72, length(sourcePosition));
  vec2 interiorPosition = vec2(
    uInteriorTransform.x * sourcePosition.x - uInteriorTransform.y * sourcePosition.y,
    uInteriorTransform.y * sourcePosition.x + uInteriorTransform.x * sourcePosition.y
  );
  vec2 sourceUV = (mix(sourcePosition, interiorPosition, interiorWeight) + 1.0) * 0.5;
  if (any(lessThan(sourceUV, vec2(0.0))) || any(greaterThan(sourceUV, vec2(1.0)))) {
    outColor = vec4(0.0);
  } else {
    // The texture is premultiplied before filtering to preserve soft transparent edges.
    outColor = texture(uArtwork, sourceUV);
    // Logos retain their original color and alpha; glow corrections belong to the plasma only.
    if (!uPlasma) return;
    float radius = length(sourceUV * 2.0 - 1.0);
    float peak = max(outColor.r, max(outColor.g, outColor.b));
    vec3 color = outColor.rgb / max(peak, 0.0001);
    // Masks follow the displaced artwork and select its existing purple and red regions.
    float purple = smoothstep(-0.12, 0.18, color.b - color.r)
      * smoothstep(0.05, 0.3, min(color.r, color.b) - color.g)
      * (1.0 - smoothstep(0.55, 0.85, radius));
    float corona = smoothstep(0.12, 0.5, color.r - color.b)
      * smoothstep(0.5, 0.8, radius);
    // Ordinary speech is visible too; the curved corona response still accents loud syllables.
    float illumination = 1.1 * uAmplitude * purple
      + 3.0 * (0.65 * uAmplitude + 0.35 * uAmplitude * uAmplitude) * corona;
    // Scale channels together to retain hue; a soft highlight limit avoids clipping filaments.
    outColor.rgb *= (1.0 + illumination) / (1.0 + illumination * peak);
    // Remove the baked dark matte from the outer glow without changing its color over black.
    float outerGlow = smoothstep(0.72, 1.0, radius);
    float glowAlpha = max(outColor.r, max(outColor.g, outColor.b));
    // Keep the illuminated glow premultiplied, including its feathered transparent edges.
    outColor.a = mix(max(outColor.a, glowAlpha), glowAlpha, outerGlow);
  }
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create an artwork shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Artwork shader compilation failed: ${message}`);
  }
  return shader;
}

export class AvatarRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | undefined;
  private program: WebGLProgram | undefined;
  private artwork: WebGLTexture | undefined;
  private displacementTexture: WebGLTexture | undefined;
  private buffer: WebGLBuffer | undefined;
  private scaleLocation: WebGLUniformLocation | null = null;
  private amplitudeLocation: WebGLUniformLocation | null = null;
  private warpStrengthLocation: WebGLUniformLocation | null = null;
  private plasmaLocation: WebGLUniformLocation | null = null;
  private interiorTransformLocation: WebGLUniformLocation | null = null;
  private field = new Float32Array(ANGLE_SAMPLES + 1);
  private width = 0;
  private height = 0;
  private disposed = false;
  private loadRequest = 0;
  private plasma = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async load(url: string, plasma = true): Promise<boolean> {
    const request = ++this.loadRequest;
    const image = new Image();
    image.src = url;
    await image.decode();
    // A slower previous selection must never replace the user's latest choice.
    if (this.disposed || request !== this.loadRequest) return false;
    if (!this.gl) {
      this.initialize(image);
    } else {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.artwork ?? null);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }
    this.plasma = plasma;
    return true;
  }

  private initialize(image: HTMLImageElement): void {
    const gl = this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) throw new Error('WebGL 2 is required to animate the artwork.');
    this.gl = gl;
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error('Could not create the artwork renderer.');
    this.program = program;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Artwork shader linking failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.useProgram(program);
    this.buffer = gl.createBuffer() ?? undefined;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer ?? null);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.scaleLocation = gl.getUniformLocation(program, 'uScale');
    this.amplitudeLocation = gl.getUniformLocation(program, 'uAmplitude');
    this.warpStrengthLocation = gl.getUniformLocation(program, 'uWarpStrength');
    this.plasmaLocation = gl.getUniformLocation(program, 'uPlasma');
    this.interiorTransformLocation = gl.getUniformLocation(program, 'uInteriorTransform');

    this.artwork = gl.createTexture() ?? undefined;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.artwork ?? null);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, 'uArtwork'), 0);

    this.displacementTexture = gl.createTexture() ?? undefined;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexture ?? null);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, ANGLE_SAMPLES + 1, 1, 0, gl.RED, gl.FLOAT, this.field);
    // Interpolate the float lookup explicitly; no optional float-filtering extension is needed.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, 'uDisplacements'), 1);
    gl.clearColor(0, 0, 0, 0);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
  }

  draw(state: AnimationState, breathingPercent = 6, rotationDegrees = 8): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.width || !this.height || this.disposed) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    // Leave space around the artwork for its displaced perimeter and any feathered glow.
    const halfSize = Math.min(this.width, this.height) * 0.34;
    gl.uniform2f(this.scaleLocation, halfSize * WARP_EXTENT * 2 / this.width, halfSize * WARP_EXTENT * 2 / this.height);
    gl.uniform1f(this.amplitudeLocation, state.amplitude);
    gl.uniform1f(this.warpStrengthLocation, this.plasma ? 1 : 0.4);
    gl.uniform1i(this.plasmaLocation, this.plasma ? 1 : 0);
    // Independent slow cycles use elapsed time, never the audio-driven perimeter phase.
    // Compute trigonometry once per frame; the shader still samples the artwork only once.
    const interiorStrength = this.plasma ? 1 : 0.25;
    const scale = 1 + interiorStrength * breathingPercent / 100 * Math.sin(state.time * Math.PI * 2 / 8);
    const rotation = -interiorStrength * rotationDegrees * Math.PI / 180 * Math.sin(state.time * Math.PI * 2 / 14);
    gl.uniform2f(this.interiorTransformLocation, Math.cos(rotation) / scale, Math.sin(rotation) / scale);
    updateDisplacements(this.field, state);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexture ?? null);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, ANGLE_SAMPLES + 1, 1, gl.RED, gl.FLOAT, this.field);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.artwork ?? null);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose(): void {
    this.disposed = true;
    const gl = this.gl;
    if (!gl) return;
    gl.deleteTexture(this.artwork ?? null);
    gl.deleteTexture(this.displacementTexture ?? null);
    gl.deleteBuffer(this.buffer ?? null);
    gl.deleteProgram(this.program ?? null);
  }
}
