import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecordingInput, waveformLevel } from '../src/recording.ts';
import { normalizeMeterLevel } from '../src/audio.ts';

test('recording samples use the same amplitude scale as OBS output peaks', () => {
  for (const peak of [0, 0.001, 0.01, 0.1, 0.5, 1]) {
    assert.equal(waveformLevel(new Float32Array([0, -peak, peak / 2])),
      normalizeMeterLevel([[0, new Float32Array([peak])[0], 1]]));
  }
});

test('recording analysis handles silence, negative waveform peaks, and clipping', () => {
  assert.equal(waveformLevel(new Float32Array(2048)), 0);
  assert.equal(waveformLevel(new Float32Array()), 0);
  assert.equal(waveformLevel([0, -0.5, 0.1]), waveformLevel([0.5]));
  assert.equal(waveformLevel([0, -2, 1]), 1);
});

test('restoring the sample uses the supplied portable URL and releases a selected file', async () => {
  const media = {
    src: '',
    pause() {},
    load() {},
    removeAttribute(name) { if (name === 'src') this.src = ''; },
  };
  const sampleUrl = 'data:audio/mpeg;base64,AA==';
  const input = new RecordingInput(media, sampleUrl);
  try {
    input.load(new File(['test recording'], 'recording.wav', { type: 'audio/wav' }));
    const selectedUrl = media.src;
    assert.equal(await (await fetch(selectedUrl)).text(), 'test recording');
    input.load();
    assert.equal(media.src, sampleUrl);
    await assert.rejects(fetch(selectedUrl));
  } finally {
    input.dispose();
  }
  assert.equal(media.src, '');
});
