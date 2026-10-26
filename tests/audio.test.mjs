import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { ObsAudioInput, ObsAuthenticationError, normalizeMeterLevel, validateObsAddress } from '../src/audio.ts';
import { createObsServer } from './fixtures/obs-server.mjs';

test('meter conversion uses output peak across channels, handles silence and malformed data', () => {
  assert.equal(normalizeMeterLevel([[0, 0, 1]]), 0);
  assert.equal(normalizeMeterLevel([[0, 0.01, 1]]), 0);
  assert.equal(normalizeMeterLevel([[0, 1, 0]]), 1);
  assert.equal(normalizeMeterLevel([[0, 0.505, 0]]), 0.5);
  assert.ok(normalizeMeterLevel([[0, 0.2, 0]]) < 0.2);
  assert.equal(normalizeMeterLevel([[0, 0, 0], [0, 1, 0]]), 1);
  assert.equal(normalizeMeterLevel([[0, 4, 0]]), 1);
  for (const invalid of [null, {}, [], [null, [], [1, NaN], [1, Infinity], [1, -1]]]) {
    assert.equal(normalizeMeterLevel(invalid), 0);
  }
});

test('connection addresses accept WebSockets and reject embedded secrets', () => {
  assert.equal(validateObsAddress('ws://127.0.0.1:4455'), 'ws://127.0.0.1:4455/');
  assert.equal(validateObsAddress('wss://localhost:4455'), 'wss://localhost:4455/');
  for (const invalid of ['bad', 'https://localhost', 'ws://user:secret@localhost', 'ws://localhost/?password=secret', 'ws://localhost/#secret']) {
    assert.throws(() => validateObsAddress(invalid));
  }
});

test('OBS v5 authenticates, explicitly subscribes to meters, and reads only the selected source', async (t) => {
  const server = await createObsServer({ password: 'test-password' });
  const audio = new ObsAudioInput(() => {});
  t.after(async () => { audio.disconnect(); await server.close(); });
  assert.deepEqual(await audio.connect(server.url, 'test-password'), ['<b>Other source</b>', 'AI Voice']);
  assert.equal(audio.state, 'connected');
  assert.equal(server.identifications[0].rpcVersion, 1);
  assert.equal(server.identifications[0].eventSubscriptions, 65536);
  assert.notEqual(server.identifications[0].authentication, 'test-password');
  assert.deepEqual(server.requests, ['GetInputList']);
  audio.selectSource('AI Voice');
  server.meters([{ inputName: 'Other', inputLevelsMul: [[0, 1, 1]] }]);
  await delay(20);
  assert.equal(audio.readLevel(performance.now()), 0);
  server.meters([{ inputName: 'AI Voice', inputLevelsMul: [[0, 0.2, 0.2]] }]);
  await delay(20);
  assert.ok(audio.readLevel(performance.now()) > 0.18);
  assert.ok(audio.readLevel(performance.now()) < 0.2);
  assert.equal(audio.readLevel(performance.now() + 301), 0);
  audio.selectSource('Other');
  assert.equal(audio.readLevel(performance.now()), 0);
  server.meters([]);
  await delay(20);
  assert.equal(audio.readLevel(performance.now()), 0);
  server.drop();
  await delay(20);
  assert.equal(audio.state, 'disconnected');
  await audio.connect(server.url, 'test-password');
  assert.equal(audio.state, 'connected');
  audio.disconnect();
  assert.equal(audio.readLevel(performance.now()), 0);
});

test('wrong passwords fail cleanly and a subsequent connection can succeed', async (t) => {
  const server = await createObsServer({ password: 'correct' });
  const audio = new ObsAudioInput(() => {});
  t.after(async () => { audio.disconnect(); await server.close(); });
  await assert.rejects(audio.connect(server.url, 'incorrect'), error =>
    error instanceof ObsAuthenticationError && /Authentication failed/.test(error.message));
  assert.equal(audio.state, 'disconnected');
  await audio.connect(server.url, 'correct');
  assert.equal(audio.state, 'connected');
});

test('a nonresponding server times out and restores the disconnected state', async (t) => {
  const server = await createObsServer({ refuseRequests: true });
  const audio = new ObsAudioInput(() => {});
  t.after(async () => { audio.disconnect(); await server.close(); });
  await assert.rejects(audio.connect(server.url, ''), /Could not connect/);
  assert.equal(audio.state, 'disconnected');
});
