import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnimationEngine, boundaryRadius, smoothAmplitude } from '../src/animation.ts';

test('the envelope follows syllables sharply while interpolating between updates', () => {
  const firstFrame = smoothAmplitude(0, 1, 1 / 60);
  assert.ok(firstFrame > 0 && firstFrame < 1);
  assert.ok(smoothAmplitude(0, 1, 0.1) > 0.85);
  const firstReleaseFrame = smoothAmplitude(1, 0, 1 / 60);
  assert.ok(firstReleaseFrame > 0 && firstReleaseFrame < 1);
  assert.ok(smoothAmplitude(1, 0, 0.1) < 0.15);
  assert.ok(smoothAmplitude(1, 0, 2) < 0.001);
  assert.equal(smoothAmplitude(0.5, 1, 0), 0.5);
});

test('flow stays slow in silence and speeds up during speech', () => {
  const idle = new AnimationEngine();
  const speech = new AnimationEngine();
  for (let i = 0; i < 60; i++) {
    idle.update(1 / 60, 0, 1, 1);
    speech.update(1 / 60, 0.6, 1, 1);
  }
  assert.ok(Math.abs(idle.state.phase - 1.1) < 1e-12);
  assert.ok(speech.state.phase > idle.state.phase * 7);
});

test('the envelope behaves the same at different display refresh rates', () => {
  const simulate = (fps) => {
    let level = 0;
    for (let i = 0; i < fps; i++) level = smoothAmplitude(level, 1, 1 / fps);
    for (let i = 0; i < fps; i++) level = smoothAmplitude(level, 0, 1 / fps);
    return level;
  };
  assert.ok(Math.abs(simulate(30) - simulate(144)) < 1e-12);
});

test('invalid targets stay bounded', () => {
  assert.equal(smoothAmplitude(0, NaN, 1), 0);
  assert.equal(smoothAmplitude(0, -1, 1), 0);
  assert.ok(smoothAmplitude(0, 100, 1) <= 1);
});

test('the boundary closes seamlessly, stays spherical, and moves continuously while idle', () => {
  const engine = new AnimationEngine();
  const initial = boundaryRadius(0.6, engine.state);
  engine.update(1, 0, 1, 1);
  assert.notEqual(boundaryRadius(0.6, engine.state), initial);
  assert.equal(engine.state.amplitude, 0);
  for (const energy of [0, 1, 1.5]) {
    const state = { phase: 3.7, amplitude: 1, energy };
    assert.ok(Math.abs(boundaryRadius(0, state) - boundaryRadius(Math.PI * 2, state)) < 1e-12);
    for (let i = 0; i < 360; i++) {
      const radius = boundaryRadius(i * Math.PI / 180, state);
      assert.ok(radius >= 0.65 && radius <= 1.35);
    }
  }
});

test('speech increases deformation while neighboring times remain continuous', () => {
  const idle = { phase: 2, amplitude: 0, energy: 0 };
  const speech = { phase: 2, amplitude: 1, energy: 1 };
  const deviation = (state) => Array.from({ length: 72 }, (_, i) =>
    Math.abs(boundaryRadius(i * Math.PI / 36, state) - 1)).reduce((a, b) => a + b, 0);
  assert.ok(deviation(speech) > deviation(idle) * 2.5);
  const next = { ...speech, phase: speech.phase + 0.001 };
  assert.ok(Math.abs(boundaryRadius(1, speech) - boundaryRadius(1, next)) < 0.001);
});

test('short syllables produce distinct boundary changes and release between bursts', () => {
  const engine = new AnimationEngine();
  const step = (target, frames) => {
    for (let i = 0; i < frames; i++) engine.update(1 / 60, target, 1, 1);
    return { ...engine.state };
  };
  const quiet = step(0.1, 12);
  const loud = step(0.8, 6);
  const gap = step(0, 9);
  const second = step(0.6, 6);
  assert.ok(loud.amplitude > 0.75);
  assert.ok(gap.amplitude < 0.16);
  assert.ok(second.amplitude > 0.55);
  // Freeze the flow phase to check that audio itself changes the boundary shape.
  const profile = (state) => Array.from({ length: 72 }, (_, i) =>
    boundaryRadius(i * Math.PI / 36, { ...state, phase: 2 }));
  const lowProfile = profile(quiet);
  const highProfile = profile(loud);
  const averageChange = highProfile.reduce((sum, radius, i) => sum + Math.abs(radius - lowProfile[i]), 0) / 72;
  assert.ok(averageChange > 0.04);
});
