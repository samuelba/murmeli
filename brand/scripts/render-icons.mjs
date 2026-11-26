#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = [
  ['logo/murmeli-mark.svg', 128, 'icons/icon-192.png', 192, false],
  ['logo/murmeli-mark.svg', 128, 'icons/icon-512.png', 512, false],
  ['logo/murmeli-app-icon.svg', 128, 'icons/icon-maskable-512.png', 512, true],
  ['logo/murmeli-app-icon.svg', 128, 'icons/apple-touch-icon.png', 180, true],
  ['logo/favicon.svg', 64, 'icons/favicon-32.png', 32, false],
];

mkdirSync(join(ROOT, 'icons'), { recursive: true });
for (const [src, viewBox, dest, size, opaque] of ICONS) {
  const density = String(Math.ceil((72 * size * 2) / viewBox));
  const args = ['-background', 'none', '-density', density, join(ROOT, src), '-resize', `${size}x${size}`];
  if (opaque) args.push('-background', '#BEE5FA', '-flatten');
  execFileSync('magick', [...args, '-strip', '-depth', '8', join(ROOT, dest)]);
  console.log(`${dest} (${size}px) <- ${src}`);
}
