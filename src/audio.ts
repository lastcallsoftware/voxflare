import OBSWebSocket, { EventSubscription } from 'obs-websocket-js/json';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

/** OBS sends linear multipliers per channel: [magnitude, output peak, input peak]. */
export function normalizeMeterLevel(levels: unknown): number {
  if (!Array.isArray(levels)) return 0;
  let peak = 0;
  for (const channel of levels) {
    if (Array.isArray(channel) && typeof channel[1] === 'number' && Number.isFinite(channel[1])) {
      peak = Math.max(peak, channel[1]);
    }
  }
  return normalizePeak(peak);
}

/** Shared level scale for OBS output peaks and local recording samples. */
export function normalizePeak(peak: number): number {
  if (!Number.isFinite(peak) || peak <= 0) return 0;
  // Keep amplitude differences visible: 0.01 is the noise floor, 1 is full scale.
  return Math.min(1, Math.max(0, (peak - 0.01) / 0.99));
}

export function validateObsAddress(address: string): string {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new Error('Enter a WebSocket address such as ws://127.0.0.1:4455.');
  }
  if (!['ws:', 'wss:'].includes(url.protocol) || !url.hostname ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Use ws:// or wss:// with no credentials, query, or fragment in the address.');
  }
  return url.href;
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('OBS did not respond within 8 seconds.')), 8000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export class ObsAudioInput {
  state: ConnectionState = 'disconnected';
  private client: OBSWebSocket | undefined;
  private source = '';
  private level = 0;
  private lastMeterTime = -Infinity;
  private onState: (state: ConnectionState, message: string) => void;

  constructor(onState: (state: ConnectionState, message: string) => void) {
    this.onState = onState;
  }

  async connect(address: string, password: string): Promise<string[]> {
    const url = validateObsAddress(address);
    this.disconnect();
    const client = new OBSWebSocket();
    this.client = client;
    this.setState('connecting', 'Connecting…');

    client.on('InputVolumeMeters', ({ inputs }) => {
      if (this.client !== client) return;
      const input = inputs.find((input) => input.inputName === this.source);
      this.level = normalizeMeterLevel(input?.inputLevelsMul);
      this.lastMeterTime = performance.now();
    });
    client.on('ConnectionClosed', () => {
      if (this.client !== client) return;
      // Let the pending connection attempt finish before enabling another one.
      if (this.state === 'connecting') return;
      this.disconnect();
      this.setState('disconnected', 'Connection closed. Connect again to retry.');
    });

    try {
      await withTimeout(client.connect(url, password || undefined, {
        rpcVersion: 1,
        // High-volume meters are not included in EventSubscription.All.
        eventSubscriptions: EventSubscription.InputVolumeMeters,
      }));
      const names = await this.listSources();
      if (this.client !== client || !client.identified) throw new Error('Connection closed.');
      this.setState('connected', 'Connected. Select an audio source.');
      return names;
    } catch (error) {
      this.disconnect();
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      // Do not display raw server error text, which may contain connection details.
      const message = code === 4009 ? 'Authentication failed. Check the server password.' :
        'Could not connect to OBS. Check the address, server settings, and password.';
      this.setState('disconnected', message);
      throw new Error(message);
    }
  }

  async listSources(): Promise<string[]> {
    const client = this.client;
    if (!client?.identified) throw new Error('Connect to OBS first.');
    const { inputs } = await withTimeout(client.call('GetInputList'));
    return inputs.flatMap((input) => typeof input.inputName === 'string' ? [input.inputName] : [])
      .sort((a, b) => a.localeCompare(b));
  }

  selectSource(name: string): void {
    this.source = name;
    this.level = 0;
    this.lastMeterTime = -Infinity;
  }

  readLevel(now: number): number {
    // Missing/inactive sources and a stalled socket must return smoothly to idle.
    return this.state === 'connected' && now - this.lastMeterTime < 300 ? this.level : 0;
  }

  disconnect(): void {
    const client = this.client;
    this.client = undefined;
    this.level = 0;
    this.lastMeterTime = -Infinity;
    if (client) {
      client.removeAllListeners();
      void client.disconnect().catch(() => {});
    }
    this.setState('disconnected', 'Disconnected');
  }

  private setState(state: ConnectionState, message: string): void {
    this.state = state;
    this.onState(state, message);
  }
}
