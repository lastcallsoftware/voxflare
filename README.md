# VoxFlare

A transparent, audio-reactive avatar built with Vite, vanilla strict TypeScript,
and Canvas 2D. Phase 1 renders a procedural purple sphere with a glowing red
boundary. It flows gently while idle and becomes more active with speech.

The supplied `public/Avatar.png` is a visual reference only. Artwork integration
and advanced rendering are deferred until this prototype is reviewed.

## Getting started

Use Node.js 24 LTS with npm in VS Code under WSL Ubuntu. From this folder:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The development view has a dark preview
background and a settings panel; the canvas itself stays transparent.

The default **Manual test** mode needs no OBS connection. Raise **Test level**
to simulate speech, then lower it to zero to see the gradual release back to
idle. **Flow speed** changes the rate of motion; **Speech response** changes
how strongly the perimeter responds. The meter shows the smoothed amplitude.

For an automatic speech test, choose **Voice recording** and press **Play** in
the audio player. A 27-second JFK speech clip from NASA is included. The avatar
reacts to its actual waveform as it plays. Pause, seek, or replay with the native
audio controls, or choose your own MP3, WAV, or another browser-supported audio
file. **Use sample recording** restores the bundled clip without starting playback.

Files are played and analyzed locally in the browser and are never uploaded.
Switching to another input mode pauses the recording. Pausing, ending, or
buffering playback returns the animation to idle through the same smoothing as
OBS audio. Presentation mode can keep a recording playing while controls are
hidden. Reloading resets the file selection to the included sample.

If Windows cannot reach the WSL development server, run
`npm run dev -- --host 0.0.0.0` and open the printed URL from Windows.

## Connecting to OBS

1. In OBS on Windows, open **Tools → WebSocket Server Settings**, enable the
   server, and note its port and password. VoxFlare uses WebSocket v5.
2. Choose **OBS WebSocket** in VoxFlare. Enter the server address and password,
   then click **Connect to OBS**. The default is `ws://127.0.0.1:4455`.
3. Select the audio input that carries the AI's voice. The list contains all
   OBS inputs; only active audio inputs emit meter data. Use **Refresh** after
   creating or renaming a source. A muted, inactive, missing, or silent source
   produces no activity beyond the idle motion.
4. Speak or play audio through that OBS source. VoxFlare only reads levels; it
   does not capture a microphone, route audio, or change OBS settings.

The WebSocket address is resolved by the browser running the page. For a Windows
browser or OBS Browser Source, `127.0.0.1` means Windows, even though Vite runs
in WSL. A browser running inside WSL may need the Windows host's reachable IP
instead. Use `wss://` when serving the page over HTTPS.

Connection failures are shown in the panel. Connection and source-list requests
time out after eight seconds. After a disconnect, click **Connect to OBS** to
retry; there is no automatic reconnect in this prototype. If meter data stops
for 300 ms, the audio target returns to zero and the animation decays to idle.

## OBS Browser Source / presentation mode

For a local review, add the Vite URL with `?overlay=1` as an OBS Browser Source,
for example `http://localhost:5173/?overlay=1`. Set its width and height to the
desired scene dimensions. Keep Vite running and accessible from Windows.

This mode shows only the avatar over a transparent background. To configure it
inside OBS, use the Browser Source's **Interact** window and press **Esc** to
show the settings. Connect and select a source, then click **Presentation mode**
or press **Esc** again. Switching modes in the same page preserves the connection.
Settings in a separate browser tab do not configure the OBS Browser Source.

All settings and credentials are held in memory only. The password field is
cleared after a successful connection. Nothing is saved to browser storage or
placed in URL parameters; only `overlay=1` is used in the URL. Reloading the
page, refreshing the Browser Source, or shutting it down requires configuration
again. Leave OBS's **Shutdown source when not visible** option off if you want
to keep the connection while switching scenes.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run typecheck` | Check TypeScript without emitting files. |
| `npm run build` | Check TypeScript and build into `dist/`. |
| `npm run preview` | Serve the production build locally for inspection. |
| `npm test` | Run the animation and OBS protocol tests using Node's test runner. |

Tests use a local mock OBS WebSocket server; they do not connect to or control
your real OBS instance. The fixture uses the WebSocket transport already
included by `obs-websocket-js`, so no additional testing dependencies are needed.

## Structure

```text
index.html          Canvas and development controls
src/
  audio.ts          OBS connection, source selection, and meter normalization
  recording.ts      Local audio-file playback analysis
  animation.ts      Audio envelope and continuous spatial waves
  renderer.ts       Transparent Canvas 2D rendering
  main.ts           Controls, resizing, and requestAnimationFrame loop
  style.css         Development layout and transparent presentation mode
tests/              Animation tests and mock OBS protocol checks
public/Avatar.png   Reference artwork, not rendered in Phase 1
public/voice-sample.mp3  Bundled NASA speech test recording
public/voice-sample.txt  Recording source and usage information
tsconfig.json       Strict TypeScript configuration
package.json        Dependencies and npm scripts
package-lock.json   Locked dependency versions
```

## Implementation notes

Audio acquisition, animation state, and rendering are separate. The animation
interpolates toward incoming audio targets every display frame using exponential
smoothing: a 6 ms attack time constant and a 45 ms release time constant.
These values give smooth transitions even though OBS meters arrive about every
50 ms, while allowing short syllables and gaps to remain distinct. Two broad
idle waves keep the shape moving slowly in silence. Two finer speech waves
change their depth and phase with the audio level, so syllables sharply reshape
the boundary. Flow also speeds up with audio intensity, then settles back to
the slow idle motion when the speaker stops.
The renderer samples that shared curve; the points do not move independently.
Audio changes deformation, flow, and luminosity rather than scaling the sphere.

Recording mode uses the browser's Web Audio API to measure a short window of
playback samples and send the peak amplitude through the same normalization and
animation envelope as OBS. It uses no microphone access or additional packages.
The included recording is JFK's “We choose the Moon” clip from
[NASA Historical Sounds](https://www.nasa.gov/historical-sounds/); its source and
NASA's media usage guidelines are recorded in `public/voice-sample.txt`.

The connection explicitly requests `EventSubscription.InputVolumeMeters`, which
is a high-volume event excluded from `EventSubscription.All`. The installed
`obs-websocket-js` v5 client handles the Hello/Identify handshake and password
challenge. See the [client documentation](https://github.com/obs-websocket-community-projects/obs-websocket-js#connecting)
and [OBS v5 protocol](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#inputvolumemeters).

For each channel, `inputLevelsMul` contains linear `[magnitude, output peak,
input peak]` values. VoxFlare uses the strongest channel's output peak, which
respects OBS input volume and mute. A linear mapping subtracts a 0.01 noise
floor and maps full-scale amplitude (1.0) to one, clamped to that range. This
preserves loudness differences instead of mapping most speech near 100%.
The meter displays this visual drive level, not a decibel reading. See the
[OBS meter implementation](https://github.com/obsproject/obs-websocket/blob/master/src/utils/Obs_VolumeMeter.cpp).
