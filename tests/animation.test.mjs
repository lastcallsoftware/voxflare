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
    const state = { phase: 3.7, amplitude: 1, energy, time: 0, modePosition: 0 };
    assert.ok(Math.abs(boundaryRadius(0, state) - boundaryRadius(Math.PI * 2, state)) < 1e-12);
    for (let i = 0; i < 360; i++) {
      const radius = boundaryRadius(i * Math.PI / 180, state);
      assert.ok(radius >= 0.65 && radius <= 1.35);
    }
  }
});

test('speech increases deformation while neighboring times remain continuous', () => {
  const idle = { phase: 2, amplitude: 0, energy: 0, time: 0, modePosition: 0 };
  const speech = { phase: 2, amplitude: 1, energy: 1, time: 0, modePosition: 0 };
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

test('mode drift is deterministic and does not reset after a four-mode tour', () => {
  const profile = time => Array.from({ length: 72 }, (_, i) =>
    boundaryRadius(i * Math.PI / 36, { phase: 2, amplitude: 0.8, energy: 0.8, time, modePosition: time / 12 }));
  const initial = profile(0);
  assert.deepEqual(profile(0), initial);
  for (const time of [48, 96, 144, 192]) {
    const current = profile(time);
    const averageChange = current.reduce((sum, radius, i) => sum + Math.abs(radius - initial[i]), 0) / current.length;
    assert.ok(averageChange > 0.007);
  }
});

test('mode transitions and parameter drift have no abrupt jumps', () => {
  // Freeze fast flow and audio so this isolates the slow morph, including every handoff.
  for (const energy of [0, 0.8, 1.5]) {
    for (let time = 0; time <= 180; time += 0.05) {
      for (let i = 0; i < 12; i++) {
        const state = { phase: 2, amplitude: energy / 1.5, energy, time, modePosition: time / 12 };
        const angle = i * Math.PI / 6;
        const before = boundaryRadius(angle, state);
        const after = boundaryRadius(angle, { ...state, time: time + 0.05, modePosition: (time + 0.05) / 12 });
        assert.ok(Math.abs(after - before) < 0.005);
        assert.ok(before >= 0.65 && before <= 1.35);
      }
      const state = { phase: 2, amplitude: energy / 1.5, energy, time, modePosition: time / 12 };
      assert.ok(Math.abs(boundaryRadius(0, state) - boundaryRadius(Math.PI * 2, state)) < 1e-12);
    }
  }
});

test('the macro clock advances independently of audio level and flow speed', () => {
  const idle = new AnimationEngine();
  const speech = new AnimationEngine();
  for (let i = 0; i < 120; i++) {
    idle.update(1 / 60, 0, 0.2, 1);
    speech.update(1 / 60, 1, 2, 1);
  }
  assert.ok(Math.abs(idle.state.time - 2) < 1e-12);
  assert.ok(Math.abs(idle.state.modePosition - 0.5) < 1e-12);
  assert.equal(idle.state.time, speech.state.time);
  assert.equal(idle.state.modePosition, speech.state.modePosition);
  assert.ok(speech.state.phase > idle.state.phase);
});

test('transition duration changes future blend speed without moving the current shape', () => {
  const fast = new AnimationEngine();
  const slow = new AnimationEngine();
  for (let i = 0; i < 60; i++) {
    fast.update(1 / 60, 0.6, 1, 1);
    slow.update(1 / 60, 0.6, 1, 1);
  }
  const before = Array.from({ length: 72 }, (_, i) => boundaryRadius(i * Math.PI / 36, fast.state));
  fast.update(0, 0.6, 1, 1, 1);
  slow.update(0, 0.6, 1, 1, 15);
  assert.deepEqual(Array.from({ length: 72 }, (_, i) => boundaryRadius(i * Math.PI / 36, fast.state)), before);
  assert.deepEqual(fast.state, slow.state);
  const startPosition = fast.state.modePosition;
  for (let i = 0; i < 60; i++) {
    fast.update(1 / 60, 0.6, 1, 1, 1);
    slow.update(1 / 60, 0.6, 1, 1, 15);
  }
  assert.ok(Math.abs(fast.state.modePosition - startPosition - 1) < 1e-12);
  assert.ok(Math.abs(slow.state.modePosition - startPosition - 1 / 15) < 1e-12);
  assert.equal(fast.state.time, slow.state.time);
  assert.equal(fast.state.phase, slow.state.phase);
});
