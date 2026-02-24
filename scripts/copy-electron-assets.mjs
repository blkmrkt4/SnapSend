// scripts/copy-electron-assets.mjs
// Copies non-TypeScript electron assets to electron-dist/ after tsc compilation.
// Called by the electron:compile npm script.

import { copyFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const assets = [
  ['electron/screenshot-overlay.html', 'electron-dist/screenshot-overlay.html'],
];

for (const [src, dest] of assets) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`Copied ${src} → ${dest}`);
}
