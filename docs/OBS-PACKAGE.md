# VoxFlare local OBS package

This folder contains the ready-to-run avatars. OBS loads them directly: no
Vite server, Node.js, VS Code, Internet connection, or extra OBS plugin is needed
during use. JavaScript, styles, artwork, and the voice sample are included.

## Install on Windows

1. Copy the entire `obs-package` folder to a stable Windows location, such as
   `C:\Users\YOUR-NAME\Documents\VoxFlare`. Keep the HTML, JavaScript, and CSS
   files together. Use a Windows-accessible folder when OBS runs on Windows;
   the WSL checkout is only needed to develop and build the package.
2. In OBS, add a **new Browser Source** to the desired scene.
3. Enable **Local file**, browse to the copied folder, and choose `chatgpt.html`,
   `claude.html`, or `plasma.html`. Each page explicitly selects its own avatar
   and starts in presentation mode with OBS audio input selected on first use.
4. Set the source dimensions (for example, 800 × 800). Transparent areas let
   the rest of your scene show through.
5. Right-click the Browser Source, choose **Interact**, and press **Esc** to
   show the controls. Enable **Dark circular background** if needed.
6. In OBS, enable **Tools → WebSocket Server Settings → Enable WebSocket server**.
   Keep authentication enabled. In VoxFlare, use `ws://127.0.0.1:4455` (or your
   configured port), enter the password, and optionally enable **Remember
   password on this PC** before clicking **Connect to OBS**.
7. Select the OBS audio source carrying the voice. Play speech and confirm that
   the smoothed meter and avatar respond. Press **Esc** to hide the controls.

Create separate Browser Sources for different avatars rather than adding the
same existing source to multiple scenes. The files need to remain on disk.

Background, input mode, motion settings, OBS address, sensitivity, and selected
audio source are remembered separately for each entry page when OBS permits
browser storage. Avatar choice starts from the selected HTML filename. Browser
Sources loading the same entry file share preferences; use copies with different
filenames if you need independent settings for the same avatar. Moving the
package changes its storage key, so preferences may need setting again.

The password field is cleared after authentication. Remembering is off by
default. When enabled, a successful connection saves the address and password
in this browser profile for this entry page. The stored password is unencrypted;
it is not included in the package files or URLs. Each avatar entry page needs
its own initial connection and opt-in.

On subsequent reloads or OBS restarts, VoxFlare connects automatically when its
input mode is **OBS WebSocket** and restores the selected audio source if it
still exists. It retries connection failures every three seconds after an
attempt finishes, allowing OBS's server to finish starting. An authentication
failure stops retries until you enter the updated password and connect. Editing
the OBS address never sends the old saved password to the new address.

**Disconnect** pauses automatic reconnection for the current page session.
**Forget saved password**, or unchecking **Remember password on this PC**, removes
the saved credential and stops automatic reconnection. An already authenticated
connection remains active until you disconnect it. Without remembering or when
storage is unavailable, enter the password and connect after each reload.

The remembered source is selected automatically if it is still available;
otherwise choose a source from the list. If storage is unavailable, configure
the controls again through Interact. Leave **Shutdown
source when not visible** and **Refresh browser source when scene becomes active**
off if you want to keep an authenticated connection while switching scenes.

The default OBS sensitivity is 10×. **Manual test** and **Voice recording** are
also available through Interact. Files selected for playback stay on your PC.

## Windows OBS verification

The release check must include your actual OBS installation; a headless browser
can check local-file rendering and a mock WebSocket, but cannot certify OBS's
embedded browser or its use of the Windows GPU.

- Open all three entry pages and verify artwork and transparent surroundings.
- Test the optional opaque circle over a white scene.
- Connect with the real OBS password and verify the chosen input's audio response.
- Switch scenes and confirm each source keeps its intended avatar.
- Enable remembering, refresh the source, and restart OBS; verify automatic
  connection and audio source restoration without a development server.
- Use **Forget saved password**, refresh again, and verify that authentication
  now requires entering the password. Nonsecret preferences should still restore.
- Move the complete package folder, reselect its entry files, and confirm it works.

## Build and update (developers only)

From the project root, run `npm run build:obs`. This rebuilds `obs-package/` and
does not change the normal web build in `dist/`. Copy the new package files over
the installed copies and refresh the Browser Sources. Keep the same Windows
folder and filenames so the saved OBS source paths remain valid.

## Artwork and sample attribution

The ChatGPT/OpenAI symbol belongs to OpenAI and the Claude symbol belongs to
Anthropic. The source symbols are from Wikimedia Commons:
[OpenAI](https://commons.wikimedia.org/wiki/File:OpenAI_logo_2025_(symbol).svg)
and [Claude](https://commons.wikimedia.org/wiki/File:Claude_AI_symbol.svg).
The sample is JFK's “We choose the Moon” speech from NASA Historical Sounds;
see the included `voice-sample.txt` for its source and usage information.
