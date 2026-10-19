export interface AnimationState {
  amplitude: number;
  phase: number;
  energy: number;
  time: number;
  modePosition: number;
}

/** Frame-rate-independent interpolation between the incoming meter targets. */
export function smoothAmplitude(current: number, target: number, dt: number): number {
  const boundedTarget = Math.min(1, Math.max(0, Number.isFinite(target) ? target : 0));
  const timeConstant = boundedTarget > current ? 0.006 : 0.045;
  return current + (boundedTarget - current) * (1 - Math.exp(-Math.max(0, dt) / timeConstant));
}

interface DeformationMode {
  idle: readonly [number, number];
  speech: readonly [number, number];
  amplitude: number;
  response: number;
  mix: number;
  offset: number;
  sectorStrength: number;
  sectors: number;
}

// Related harmonic families: broad flow, curling folds, fine ripples, and long swells.
const MODES: readonly DeformationMode[] = [
  { idle: [3, 5], speech: [9, 13], amplitude: 1, response: 1, mix: 0.6, offset: 0, sectorStrength: 0.16, sectors: 1 },
  { idle: [2, 6], speech: [8, 12], amplitude: 0.93, response: 0.94, mix: 0.52, offset: 1.8, sectorStrength: 0.28, sectors: 2 },
  { idle: [4, 7], speech: [11, 15], amplitude: 0.87, response: 0.88, mix: 0.66, offset: 3.9, sectorStrength: 0.21, sectors: 1 },
  { idle: [3, 4], speech: [7, 11], amplitude: 0.97, response: 0.98, mix: 0.45, offset: 5.6, sectorStrength: 0.32, sectors: 2 },
];

function modeDeformation(angle: number, state: AnimationState, mode: DeformationMode): number {
  const phase = state.phase;
  const energy = state.energy;
  const time = state.time;
  const offset = mode.offset + 0.35 * Math.sin(time * 0.071 + mode.offset) + 0.2 * Math.sin(time * 0.047);
  const idleMix = 0.65 + 0.08 * Math.sin(time * 0.061 + mode.offset);
  const speechMix = mode.mix + 0.08 * Math.sin(time * 0.083 + mode.offset);
  const amplitude = mode.amplitude * (0.95 + 0.05 * Math.sin(time * 0.053 + mode.offset));
  const response = mode.response * (0.95 + 0.05 * Math.sin(time * 0.097 + mode.offset));
  const sectorDirection = time * 0.043 + mode.offset + 0.3 * Math.sin(time * 0.037);
  const sectorStrength = mode.sectorStrength + 0.05 * Math.sin(time * 0.067 + mode.offset);
  const sector = 1 - sectorStrength * (0.5 + 0.5 * Math.cos(mode.sectors * angle - sectorDirection));
  const idle = idleMix * Math.sin(mode.idle[0] * angle + phase + offset) +
    (1 - idleMix) * Math.sin(mode.idle[1] * angle - phase * 0.73 - offset * 0.7 + 1.2);
  // Level changes still reshape the ripples immediately; slow drift only changes their character.
  const speech = speechMix * Math.sin(mode.speech[0] * angle + phase * 2.8 + energy * 1.7 + offset) +
    (1 - speechMix) * Math.sin(mode.speech[1] * angle - phase * 2.2 - energy * 1.3 - offset * 0.8 + 2.4);
  return sector * (idle * 0.055 * amplitude + speech * energy * 0.19 * response);
}

/** Crossfade coherent modes while keeping a closed, bounded perimeter. */
export function boundaryRadius(angle: number, state: AnimationState): number {
  // The macro clock is independent of audio and flow speed; it never resets on a mode change.
  const position = state.modePosition + 0.18 * Math.sin(state.modePosition * 0.444);
  const index = Math.floor(position);
  const fraction = position - index;
  const blend = fraction * fraction * (3 - 2 * fraction);
  const from = modeDeformation(angle, state, MODES[index % MODES.length]);
  const to = modeDeformation(angle, state, MODES[(index + 1) % MODES.length]);
  return 1 + from * (1 - blend) + to * blend;
}

export class AnimationEngine {
  readonly state: AnimationState = { amplitude: 0, phase: 0, energy: 0, time: 0, modePosition: 0 };

  update(dt: number, target: number, speed: number, response: number, transitionSeconds = 4): void {
    this.state.time += dt;
    // Integrate progress so changing the duration never jumps to another blend position.
    this.state.modePosition += dt / transitionSeconds;
    this.state.amplitude = smoothAmplitude(this.state.amplitude, target, dt);
    this.state.energy = Math.min(1.5, this.state.amplitude * response);
    this.state.phase += dt * speed * 2 * (0.55 + this.state.energy * 7);
  }
}
