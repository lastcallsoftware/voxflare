import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = resolve(root, 'obs-package');
const media = {
  'derived/avatar-transparent.png': 'image/png',
  'derived/chatgpt.svg': 'image/svg+xml',
  'derived/claude.svg': 'image/svg+xml',
  'voice-sample.mp3': 'audio/mpeg',
};
const embeddedAssets = {};
for (const [path, mime] of Object.entries(media)) {
  const data = await readFile(resolve(root, 'public', path));
  embeddedAssets[path] = `data:${mime};base64,${data.toString('base64')}`;
}

// A classic script and embedded media also support local-file loading without module CORS flags.
await build({
  root,
  configFile: false,
  publicDir: false,
  base: './',
  define: { 'import.meta.env.VOXFLARE_ASSETS': JSON.stringify(embeddedAssets) },
  build: {
    outDir,
    emptyOutDir: true,
    lib: {
      entry: resolve(root, 'src/main.ts'),
      name: 'VoxFlare',
      formats: ['iife'],
      fileName: () => 'voxflare.js',
      cssFileName: 'voxflare',
    },
  },
});

const template = (await readFile(resolve(root, 'index.html'), 'utf8'))
  .replace('</head>', '  <link rel="stylesheet" href="./voxflare.css" />\n  </head>')
  .replace('<script type="module" src="/src/main.ts"></script>', '<script src="./voxflare.js"></script>')
  .replace(/src="\/derived\/([^\"]+)"/g, 'data-asset="derived/$1"')
  .replace(' src="/voice-sample.mp3"', '');

for (const avatar of ['plasma', 'chatgpt', 'claude']) {
  const html = template.replace('<html lang="en">',
    `<html lang="en" data-local-package="1" data-avatar="${avatar}" data-overlay="1" data-input-mode="obs">`);
  await writeFile(resolve(outDir, `${avatar}.html`), html);
}
await copyFile(resolve(root, 'docs/OBS-PACKAGE.md'), resolve(outDir, 'README.md'));
await copyFile(resolve(root, 'public/voice-sample.txt'), resolve(outDir, 'voice-sample.txt'));
console.log(`OBS package ready: ${outDir}`);
