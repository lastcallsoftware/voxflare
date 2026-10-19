import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundaryRadius } from '../src/animation.ts';
import { ANGLE_SAMPLES, WARP_EXTENT, updateDisplacements } from '../src/displacement.ts';

test('image displacement uses the existing animation waves and closes the angular seam', () => {
  const field = new Float32Array(ANGLE_SAMPLES + 1);
  const state = { amplitude: 0.8, energy: 1.2, phase: 4.7 };
  updateDisplacements(field, state);
  for (let i = 0; i <= ANGLE_SAMPLES; i++) {
    const angle = i / ANGLE_SAMPLES * Math.PI * 2 - Math.PI;
    assert.ok(Math.abs(field[i] - (boundaryRadius(angle, state) - 1)) < 1e-7);
  }
  assert.ok(Math.abs(field[0] - field[ANGLE_SAMPLES]) < 1e-7);
});

test('the padded image extent contains the full allowed deformation', () => {
  const field = new Float32Array(ANGLE_SAMPLES + 1);
  for (const energy of [0, 0.5, 1, 1.5]) {
    for (let phase = 0; phase < 10; phase += 0.3) {
      updateDisplacements(field, { amplitude: energy / 1.5, energy, phase });
      assert.ok(field.every(value => 1 + value > 0 && 1 + value < WARP_EXTENT));
    }
  }
});
