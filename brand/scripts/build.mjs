#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logoMark, appIcon, favicon } from './lib/logo.mjs';
import { wordmark } from './lib/wordmark.mjs';
import { mascotSvg, thinkingAnimated } from './lib/mascot.mjs';
import { animalList, avatarSvg } from './lib/avatars.mjs';
import { accessoryList, accessorySvg } from './lib/accessories.mjs';
import { tokensCss } from './lib/tokens-css.mjs';
import { contrastReport } from './lib/contrast.mjs';
import { previewHtml } from './lib/preview.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (rel, content) => {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
};

const tokens = JSON.parse(readFileSync(join(ROOT, 'tokens/tokens.json'), 'utf8'));

const logo = {
  static: logoMark(),
  animated: logoMark({ animated: true }),
  wordmark: wordmark(),
  wordmarkDark: wordmark({ color: '#FBF7EE' }),
  favicon: favicon(),
  appIcon: appIcon(),
  thinking: thinkingAnimated(),
};
out('logo/murmeli-mark.svg', logo.static);
out('logo/murmeli-mark-animated.svg', logo.animated);
out('logo/murmeli-wordmark.svg', logo.wordmark);
out('logo/murmeli-wordmark-dark.svg', logo.wordmarkDark);
out('logo/favicon.svg', logo.favicon);
out('logo/murmeli-app-icon.svg', logo.appIcon);

const POSES = ['happy', 'thinking', 'cheering', 'encouraging', 'sleeping'];
const mascots = POSES.map((id) => ({ id, svg: mascotSvg(id) }));
mascots.forEach((m) => out(`mascot/${m.id}.svg`, m.svg));
out('mascot/thinking-animated.svg', logo.thinking);

const avatars = animalList.map((a) => ({ ...a, svg: avatarSvg(a) }));
avatars.forEach((a) => out(`avatars/${a.id}.svg`, a.svg));
const accessories = accessoryList.map((a) => ({ ...a, svg: accessorySvg(a) }));
accessories.forEach((a) => out(`avatars/accessories/${a.id}.svg`, a.svg));

const names = [...avatars, ...accessories].flatMap((a) => Object.values(a.name));
const eszett = names.filter((n) => n.includes(String.fromCharCode(0xdf)));
if (eszett.length) throw new Error(`German names must not contain the sharp s: ${eszett.join(', ')}`);

const manifest = {
  viewBox: '0 0 120 120',
  animals: avatars.map(({ id, name }) => ({ id, file: `${id}.svg`, name })),
  accessories: accessories.map(({ id, name }) => ({ id, file: `accessories/${id}.svg`, name })),
  backgrounds: tokens.avatarBackgrounds,
};
out('avatars/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

const css = tokensCss(tokens);
out('tokens/tokens.css', css);

const report = contrastReport(tokens.themes);
out(
  'preview.html',
  previewHtml({ css, logo, mascots, avatars, accessories, backgrounds: tokens.avatarBackgrounds, tokens, report }),
);

console.log('theme  pair                                  ratio   min  result');
for (const r of report) {
  console.log(
    `${r.theme.padEnd(6)} ${`${r.fg} on ${r.bg}`.padEnd(37)} ${r.ratio.toFixed(2).padStart(6)} ${String(r.min).padStart(4)}  ${r.pass ? 'pass' : 'FAIL'}`,
  );
}
const failed = report.filter((r) => !r.pass);
if (failed.length) {
  console.error(`${failed.length} contrast checks failed`);
  process.exitCode = 1;
}
