import { normalizePeak } from './audio.ts';

export function waveformLevel(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  return normalizePeak(peak);
}

/** Measures file playback locally; it does not capture a microphone or upload audio. */
export class RecordingInput {
  private media: HTMLAudioElement;
  private context: AudioContext | undefined;
  private analyser: AnalyserNode | undefined;
  private samples = new Float32Array(2048);
  private objectUrl: string | undefined;

  constructor(media: HTMLAudioElement) {
    this.media = media;
  }

  async resume(): Promise<void> {
    // Create the graph once, when playback is started by the user.
    if (!this.context) {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = this.samples.length;
      const source = context.createMediaElementSource(this.media);
      source.connect(analyser);
      analyser.connect(context.destination);
      this.context = context;
      this.analyser = analyser;
    }
    await this.context.resume();
  }

  load(file?: File): void {
    this.media.pause();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = file ? URL.createObjectURL(file) : undefined;
    this.media.src = this.objectUrl ?? '/voice-sample.mp3';
    this.media.load();
  }

  readLevel(): number {
    if (!this.analyser || this.context?.state !== 'running' ||
        this.media.paused || this.media.ended || this.media.seeking || this.media.readyState < 3) {
      return 0;
    }
    this.analyser.getFloatTimeDomainData(this.samples);
    return waveformLevel(this.samples);
  }

  dispose(): void {
    this.media.pause();
    this.media.removeAttribute('src');
    this.media.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    void this.context?.close();
  }
}
