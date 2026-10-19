export interface AnimationState {
  amplitude: number;
  phase: number;
  energy: number;
}

/** Frame-rate-independent interpolation between the incoming meter targets. */
export function smoothAmplitude(current: number, target: number, dt: number): number {
  const boundedTarget = Math.min(1, Math.max(0, Number.isFinite(target) ? target : 0));
  const timeConstant = boundedTarget > current ? 0.006 : 0.045;
  return current + (boundedTarget - current) * (1 - Math.exp(-Math.max(0, dt) / timeConstant));
}

/** Two idle waves and two audio-driven ripples share a continuous, closed boundary. */
export function boundaryRadius(angle: number, state: AnimationState): number {
  const phase = state.phase;
  const energy = state.energy;
  const idle = 0.65 * Math.sin(3 * angle + phase) +
    0.35 * Math.sin(5 * angle - phase * 0.73 + 1.2);
  // Level changes move the ripples as well as changing their depth.
  const speech = 0.6 * Math.sin(9 * angle + phase * 2.8 + energy * 1.7) +
    0.4 * Math.sin(13 * angle - phase * 2.2 - energy * 1.3 + 2.4);
  return 1 + idle * 0.055 + speech * energy * 0.19;
}

export class AnimationEngine {
  readonly state: AnimationState = { amplitude: 0, phase: 0, energy: 0 };

  update(dt: number, target: number, speed: number, response: number): void {
    this.state.amplitude = smoothAmplitude(this.state.amplitude, target, dt);
    this.state.energy = Math.min(1.5, this.state.amplitude * response);
    this.state.phase += dt * speed * 2 * (0.55 + this.state.energy * 7);
  }
}
