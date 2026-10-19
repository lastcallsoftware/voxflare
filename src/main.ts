import './style.css';
import { ObsAudioInput } from './audio';
import { AnimationEngine } from './animation';
import { AvatarRenderer } from './renderer';
import { RecordingInput } from './recording';

function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing element: ${selector}`);
  return result;
}

const preview = element<HTMLElement>('#preview');
const renderer = new AvatarRenderer(element<HTMLCanvasElement>('#canvas'));
const engine = new AnimationEngine();
const mode = element<HTMLSelectElement>('#mode');
const manualLevel = element<HTMLInputElement>('#manual-level');
const manualControls = element<HTMLElement>('#manual-controls');
const recordingControls = element<HTMLElement>('#recording-controls');
const recordingMedia = element<HTMLAudioElement>('#recording');
const recordingFile = element<HTMLInputElement>('#recording-file');
const recordingStatus = element<HTMLElement>('#recording-status');
const recording = new RecordingInput(recordingMedia);
const obsControls = element<HTMLFormElement>('#obs-controls');
const address = element<HTMLInputElement>('#obs-address');
const password = element<HTMLInputElement>('#obs-password');
const connect = element<HTMLButtonElement>('#connect');
const disconnect = element<HTMLButtonElement>('#disconnect');
const sources = element<HTMLSelectElement>('#obs-source');
const refresh = element<HTMLButtonElement>('#refresh-sources');
const sensitivity = element<HTMLInputElement>('#obs-sensitivity');
const status = element<HTMLElement>('#connection-status');
const previewStatus = element<HTMLElement>('#preview-status');
const speed = element<HTMLInputElement>('#motion-speed');
const transition = element<HTMLInputElement>('#mode-transition');
const response = element<HTMLInputElement>('#speech-response');
const breathing = element<HTMLInputElement>('#interior-breathing');
const rotation = element<HTMLInputElement>('#interior-rotation');
const meter = element<HTMLMeterElement>('#audio-meter');
const audioValue = element<HTMLOutputElement>('#audio-value');
const frameRate = element<HTMLElement>('#frame-rate');
const averageWork = element<HTMLElement>('#average-work');
const peakWork = element<HTMLElement>('#peak-work');

const audio = new ObsAudioInput((state, message) => {
  const busy = state === 'connecting';
  const connected = state === 'connected';
  status.textContent = message;
  connect.disabled = busy || connected;
  disconnect.disabled = !connected;
  address.disabled = busy || connected;
  password.disabled = busy || connected;
  sources.disabled = !connected;
  refresh.disabled = !connected;
  updatePreviewStatus();
});

function updatePreviewStatus(): void {
  if (mode.value === 'recording') {
    previewStatus.textContent = recordingMedia.paused ? 'Recording paused' : 'Recording playing';
  } else {
    previewStatus.textContent = mode.value === 'manual' ? 'Manual test' :
      audio.state === 'connected' ? 'OBS connected' : 'OBS disconnected';
  }
}

mode.addEventListener('change', () => {
  manualControls.hidden = mode.value !== 'manual';
  recordingControls.hidden = mode.value !== 'recording';
  obsControls.hidden = mode.value !== 'obs';
  if (mode.value !== 'recording') recordingMedia.pause();
  updatePreviewStatus();
});

recordingFile.addEventListener('change', () => {
  const file = recordingFile.files?.[0];
  if (!file) return;
  recording.load(file);
  recordingStatus.textContent = `Loaded ${file.name}. Press Play to test.`;
});
element<HTMLButtonElement>('#load-sample').addEventListener('click', () => {
  recording.load();
  recordingFile.value = '';
  recordingStatus.textContent = 'Sample ready. Press Play to test.';
});
recordingMedia.addEventListener('play', async () => {
  try {
    await recording.resume();
    if (!recordingMedia.paused) recordingStatus.textContent = 'Playing voice recording.';
  } catch {
    recordingMedia.pause();
    recordingStatus.textContent = 'Could not start audio analysis. Reload the page and try again.';
  }
  updatePreviewStatus();
});
recordingMedia.addEventListener('pause', () => {
  recordingStatus.textContent = 'Paused. Press Play to continue.';
  updatePreviewStatus();
});
recordingMedia.addEventListener('ended', () => {
  recordingStatus.textContent = 'Recording finished. Press Play to replay.';
  updatePreviewStatus();
});
recordingMedia.addEventListener('error', () => {
  recordingStatus.textContent = 'Could not play this recording. Try an MP3 or WAV file, or use the sample.';
  updatePreviewStatus();
});

function showSources(names: string[]): void {
  const previous = sources.value;
  sources.replaceChildren(new Option('Select an audio source', ''));
  for (const name of names) sources.add(new Option(name, name));
  sources.value = names.includes(previous) ? previous : '';
  audio.selectSource(sources.value);
}

obsControls.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    showSources(await audio.connect(address.value.trim(), password.value));
    // Keep credentials in memory only; clear the form after authentication.
    password.value = '';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Connection failed.';
  }
});

disconnect.addEventListener('click', () => audio.disconnect());
sources.addEventListener('change', () => audio.selectSource(sources.value));
refresh.addEventListener('click', async () => {
  refresh.disabled = true;
  try {
    showSources(await audio.listSources());
    status.textContent = 'Connected. Source list refreshed.';
  } catch {
    status.textContent = 'Could not load sources. Disconnect and reconnect to try again.';
  } finally {
    refresh.disabled = audio.state !== 'connected';
  }
});

manualLevel.addEventListener('input', () => {
  element<HTMLOutputElement>('#manual-value').value = `${Math.round(Number(manualLevel.value) * 100)}%`;
});
sensitivity.addEventListener('input', () => {
  element<HTMLOutputElement>('#sensitivity-value').value = `${Number(sensitivity.value).toFixed(1)}×`;
});
speed.addEventListener('input', () => {
  element<HTMLOutputElement>('#speed-value').value = `${Number(speed.value).toFixed(1)}×`;
});
transition.addEventListener('input', () => {
  element<HTMLOutputElement>('#transition-value').value = `${transition.value} s`;
});
response.addEventListener('input', () => {
  element<HTMLOutputElement>('#response-value').value = `${Number(response.value).toFixed(1)}×`;
});
breathing.addEventListener('input', () => {
  element<HTMLOutputElement>('#breathing-value').value = `±${Number(breathing.value).toFixed(1)}%`;
});
rotation.addEventListener('input', () => {
  element<HTMLOutputElement>('#rotation-value').value = `±${Number(rotation.value).toFixed(1)}°`;
});

let overlay = new URLSearchParams(window.location.search).get('overlay') === '1';
function applyOverlay(): void {
  document.body.classList.toggle('overlay', overlay);
  element<HTMLElement>('.app-header').hidden = overlay;
  element<HTMLElement>('.panel').hidden = overlay;
  element<HTMLElement>('.preview-heading').hidden = overlay;
  element<HTMLElement>('.preview-caption').hidden = overlay;
}
function toggleOverlay(): void {
  overlay = !overlay;
  const url = new URL(window.location.href);
  if (overlay) url.searchParams.set('overlay', '1');
  else url.searchParams.delete('overlay');
  window.history.replaceState(null, '', url);
  applyOverlay();
  if (!overlay) element<HTMLButtonElement>('#overlay').focus();
}
element<HTMLButtonElement>('#overlay').addEventListener('click', toggleOverlay);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') toggleOverlay();
});
applyOverlay();

const artworkStatus = element<HTMLElement>('#artwork-status');
void renderer.load('/derived/avatar-transparent.png').then(() => {
  artworkStatus.hidden = true;
}).catch((error: unknown) => {
  artworkStatus.textContent = 'Could not load the avatar. Check that WebGL 2 is enabled, then reload.';
  renderer.dispose();
  console.error(error);
});

const resizeObserver = new ResizeObserver(() => {
  renderer.resize(preview.clientWidth, preview.clientHeight);
});
resizeObserver.observe(preview);

let previousTime = performance.now();
let lastMeterUpdate = 0;
let frameId = 0;
let sampleStarted = performance.now();
let sampleFrames = 0;
let sampleWork = 0;
let samplePeak = 0;
function resetPerformanceSample(): void {
  sampleStarted = performance.now();
  sampleFrames = 0;
  sampleWork = 0;
  samplePeak = 0;
  frameRate.textContent = averageWork.textContent = peakWork.textContent = '—';
}
// Do not count a background tab's suspended animation as a performance slowdown.
document.addEventListener('visibilitychange', resetPerformanceSample);
function frame(now: number): void {
  const workStarted = performance.now();
  const dt = Math.min((now - previousTime) / 1000, 0.1);
  previousTime = now;
  // Calibrate OBS independently of the full-scale manual control and bundled recording.
  // The animation envelope clamps the amplified target before smoothing motion and lighting.
  const level = mode.value === 'manual' ? Number(manualLevel.value) :
    mode.value === 'recording' ? recording.readLevel() : audio.readLevel(now) * Number(sensitivity.value);
  engine.update(dt, level, Number(speed.value), Number(response.value), Number(transition.value));
  renderer.draw(engine.state, Number(breathing.value), Number(rotation.value));
  if (now - lastMeterUpdate >= 100) {
    meter.value = engine.state.amplitude;
    audioValue.value = `${Math.round(engine.state.amplitude * 100)}%`;
    lastMeterUpdate = now;
  }
  // Wall-clock time for this callback, including WebGL submission but not GPU execution.
  // Average over one second without forcing GPU synchronization or reading pixels back.
  const workFinished = performance.now();
  const work = workFinished - workStarted;
  sampleFrames++;
  sampleWork += work;
  samplePeak = Math.max(samplePeak, work);
  const elapsed = workFinished - sampleStarted;
  if (elapsed >= 1000) {
    if (!overlay) {
      frameRate.textContent = `${(sampleFrames * 1000 / elapsed).toFixed(1)} fps`;
      averageWork.textContent = `${(sampleWork / sampleFrames).toFixed(2)} ms`;
      peakWork.textContent = `${samplePeak.toFixed(2)} ms`;
    }
    sampleStarted = workFinished;
    sampleFrames = 0;
    sampleWork = 0;
    samplePeak = 0;
  }
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);

// Vite can replace this module while developing; release its ongoing work first.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', resetPerformanceSample);
    audio.disconnect();
    recording.dispose();
    renderer.dispose();
  });
}
