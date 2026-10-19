import { boundaryRadius, type AnimationState } from './animation.ts';

export const ANGLE_SAMPLES = 512;
export const WARP_EXTENT = 1.4;
export const FIXED_CENTER_RADIUS = 0.3;
export const FULL_WARP_RADIUS = 0.8;

/** Reuse the Phase 1 waves, with a duplicate endpoint for a seamless lookup. */
export function updateDisplacements(field: Float32Array, state: AnimationState): void {
  for (let i = 0; i <= ANGLE_SAMPLES; i++) {
    field[i] = boundaryRadius(i / ANGLE_SAMPLES * Math.PI * 2 - Math.PI, state) - 1;
  }
}
