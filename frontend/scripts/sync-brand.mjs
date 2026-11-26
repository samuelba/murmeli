#!/usr/bin/env node
// Copies the brand assets (source of truth: ../brand) into the frontend.
//   node scripts/sync-brand.mjs          copy (and write public/manifest.webmanifest)
//   node scripts/sync-brand.mjs --check  exit 1 when a copy is missing or differs
// The copies are committed because the Docker build only sees frontend/. Without ../brand
// (for example inside the Docker build) both modes skip with a notice.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brand = resolve(frontend, '..', 'brand');

const DIRECTORY_RULES = [
  { from: 'logo', to: 'public/brand', pattern: /\.svg$/ },
  { from: 'icons', to: 'public/brand', pattern: /\.png$/ },
  { from: 'mascot', to: 'public/brand/mascot', pattern: /\.svg$/ },
  { from: 'avatars', to: 'public/brand/avatars', pattern: /\.(svg|json)$/ },
  { from: 'avatars/accessories', to: 'public/brand/avatars/accessories', pattern: /\.svg$/ },
];

const FILE_RULES = [
  { from: 'tokens/tokens.css', to: 'src/styles/_brand-tokens.scss' },
  { from: 'avatars/manifest.json', to: 'src/app/core/avatars/avatar-manifest.json' },
  // Emails reference ${APP_URL}/brand/murmeli-mark.png (docs/internal/api-accounts.md).
  { from: 'icons/icon-192.png', to: 'public/brand/murmeli-mark.png' },
];

async function pairs() {
  const result = [...FILE_RULES];
  for (const rule of DIRECTORY_RULES) {
    const entries = await readdir(join(brand, rule.from), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && rule.pattern.test(entry.name)) {
        result.push({ from: join(rule.from, entry.name), to: join(rule.to, entry.name) });
      }
    }
  }
  return result.sort((a, b) => a.to.localeCompare(b.to));
}

function tokenValue(css, name) {
  const match = css.match(new RegExp(`--mu-color-${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) {
    throw new Error(`Token --mu-color-${name} not found in tokens.css`);
  }
  return match[1];
}

async function manifest() {
  const brandTs = await readFile(join(frontend, 'src/app/core/brand.ts'), 'utf8');
  const name = brandTs.match(/BRAND_NAME = '([^']+)'/)?.[1];
  if (!name) {
    throw new Error('BRAND_NAME not found in src/app/core/brand.ts');
  }
  const css = await readFile(join(brand, 'tokens/tokens.css'), 'utf8');
  const icon = (src, sizes, purpose) => ({ src, sizes, type: 'image/png', purpose });
  const content = {
    name,
    short_name: name,
    lang: 'de-CH',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: tokenValue(css, 'bg'),
    theme_color: tokenValue(css, 'bg'),
    icons: [
      { src: '/brand/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      icon('/brand/icon-192.png', '192x192', 'any'),
      icon('/brand/icon-512.png', '512x512', 'any'),
      icon('/brand/icon-maskable-512.png', '512x512', 'maskable'),
    ],
  };
  return `${JSON.stringify(content, null, 2)}\n`;
}

const MANIFEST = 'public/manifest.webmanifest';

async function hash(path) {
  if (!existsSync(path)) {
    return null;
  }
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

async function check(list) {
  const stale = [];
  for (const { from, to } of list) {
    if ((await hash(join(brand, from))) !== (await hash(join(frontend, to)))) {
      stale.push(`${to} (from brand/${from})`);
    }
  }
  const current = existsSync(join(frontend, MANIFEST))
    ? await readFile(join(frontend, MANIFEST), 'utf8')
    : null;
  if (current !== (await manifest())) {
    stale.push(`${MANIFEST} (from BRAND_NAME and tokens.css)`);
  }
  if (stale.length > 0) {
    console.error(`Brand copies are out of date. Run "npm run brand:sync".\n${stale.join('\n')}`);
    process.exit(1);
  }
  console.log(`Brand copies are in sync (${list.length} files).`);
}

async function sync(list) {
  for (const { from, to } of list) {
    const target = join(frontend, to);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(brand, from), target);
  }
  await writeFile(join(frontend, MANIFEST), await manifest());
  console.log(
    `Copied ${list.length} brand files into ${relative(process.cwd(), frontend) || '.'}.`,
  );
}

if (!existsSync(brand)) {
  console.log(`Skipping: ${brand} not found (expected inside the Docker build).`);
  process.exit(0);
}

const list = await pairs();
await (process.argv.includes('--check') ? check(list) : sync(list));
