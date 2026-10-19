# VoxFlare

A transparent, audio-reactive avatar built with Vite and vanilla strict
TypeScript. Phase 2 animates the original purple plasma artwork and red corona
using a small WebGL 2 radial-displacement renderer. It flows gently while idle
and responds sharply to speech. OBS acquisition and audio controls are unchanged.

The supplied `public/Avatar.png` stays unchanged. A separate alpha-masked image
in `public/derived/` removes its dark surroundings while retaining its original
pixel colors and texture. This is a first image-animation pass for visual review;
particles and advanced lighting remain outside the scope.

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
  displacement.ts   Angular displacement field from the Phase 1 waves
  renderer.ts       Transparent WebGL 2 image displacement
  main.ts           Controls, resizing, and requestAnimationFrame loop
  style.css         Development layout and transparent presentation mode
tests/              Animation, image-displacement, and OBS protocol checks
public/Avatar.png   Unmodified original artwork (capital A)
public/derived/     Alpha matte and color-preserving transparent avatar
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
The renderer samples that shared curve; pixels do not move independently.
Audio changes local deformation and flow rather than scaling the entire avatar.

### Image displacement

The renderer uploads the 1254 × 1254 transparent artwork once. Each frame, the
animation engine supplies 513 angular displacement values (including a duplicate
endpoint) using the existing `boundaryRadius` function. A small shader interpolates
that field and inverse-maps each output pixel into the original texture using
its polar angle and radius. Inverse sampling avoids gaps and wedge seams.

The central 30% of the image radius remains fixed. A smooth radial falloff
increases the deformation until it reaches full strength at 80% of the radius,
near the corona. Extra space around the image accommodates the animated glow.
Texture filtering uses premultiplied alpha so soft edges blend correctly over
the OBS scene. In the outer glow, alpha is reduced toward the strongest
premultiplied color channel to remove the baked dark matte over light backgrounds;
this leaves its color over black unchanged. The core is unaffected.
No procedural substitute, new lighting, or particles are drawn.

A Canvas 2D pixel-warp prototype measured approximately 18 ms per frame at
512 × 512 and 35 ms at 768 × 768 in this WSL environment, before display overhead.
That was too slow for a consistent 60 Hz target at useful image resolution, so
the image warp uses WebGL 2. No graphics library or new npm dependency is needed.
The browser/OBS Browser Source must have WebGL 2 available; a loading or failure
message appears if the image or graphics context cannot initialize.

### Derived artwork

`public/derived/avatar-matte.png` is a background-removal result from the original
image. Only its alpha channel is used in `avatar-transparent.png`; every RGB
channel in the final image is copied unchanged from `public/Avatar.png`.
The original is never overwritten. The derived image retains the corona's soft
alpha boundary and a solid interior. To reproduce the color-preserving merge
with FFmpeg (only needed for asset preparation, not development or builds):

```sh
ffmpeg -i public/Avatar.png -i public/derived/avatar-matte.png \
  -filter_complex '[1:v]alphaextract[alpha];[0:v][alpha]alphamerge' \
  -frames:v 1 public/derived/avatar-transparent.png
```

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
