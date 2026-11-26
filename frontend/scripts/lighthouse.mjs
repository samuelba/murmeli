#!/usr/bin/env node
// Lighthouse (mobile, simulated throttling) against the production build, served like nginx
// by scripts/serve-dist.mjs with a tiny fake backend per page. Run `npm run build` first.
//   npm run lighthouse                 all pages, fails below the targets
//   npm run lighthouse -- --page map   one page (landing, picker, map)
// HTML and JSON reports go to lighthouse-reports/ (gitignored).
import { chromium } from '@playwright/test';
import { launch } from 'chrome-launcher';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reports = join(frontend, 'lighthouse-reports');

const TARGETS = { performance: 85, accessibility: 95, 'best-practices': 95 };
const PAGES = [
  { name: 'landing', mock: 'guest', path: '/', port: 4411 },
  { name: 'picker', mock: 'family', path: '/', port: 4412 },
  { name: 'map', mock: 'kid', path: '/learn', port: 4413 },
];

function only() {
  const index = process.argv.indexOf('--page');
  return index >= 0 ? process.argv[index + 1] : null;
}

async function serve(page) {
  const child = spawn(
    process.execPath,
    [join(frontend, 'scripts', 'serve-dist.mjs'), '--port', String(page.port), '--mock', page.mock],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
  await new Promise((resolveReady, reject) => {
    child.once('exit', (code) => reject(new Error(`serve-dist exited with ${code}`)));
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Serving')) {
        resolveReady();
      }
    });
  });
  return child;
}

async function audit(chrome, page) {
  const server = await serve(page);
  try {
    const url = `http://localhost:${page.port}${page.path}`;
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        output: ['html', 'json'],
        logLevel: 'error',
        onlyCategories: Object.keys(TARGETS),
      },
      undefined,
    );
    if (!result) {
      throw new Error(`Lighthouse returned nothing for ${url}`);
    }
    const [html, json] = result.report;
    await writeFile(join(reports, `${page.name}.html`), html);
    await writeFile(join(reports, `${page.name}.json`), json);
    const scores = Object.fromEntries(
      Object.keys(TARGETS).map((id) => [
        id,
        Math.round((result.lhr.categories[id]?.score ?? 0) * 100),
      ]),
    );
    const failing = Object.values(result.lhr.audits)
      .filter(
        (item) =>
          item.score !== null && item.score < 0.9 && item.scoreDisplayMode !== 'informative',
      )
      .map((item) => `${item.id} (${Math.round((item.score ?? 0) * 100)})`);
    return { page: page.name, url, ...scores, failing };
  } finally {
    server.kill();
  }
}

await mkdir(reports, { recursive: true });
const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-first-run', '--disable-dev-shm-usage'],
});
const results = [];
try {
  for (const page of PAGES.filter((item) => !only() || item.name === only())) {
    results.push(await audit(chrome, page));
  }
} finally {
  await chrome.kill();
}

let ok = true;
for (const result of results) {
  const line = Object.entries(TARGETS).map(([id, target]) => {
    const pass = result[id] >= target;
    ok &&= pass;
    return `${id} ${result[id]}${pass ? '' : ` (< ${target})`}`;
  });
  console.log(`${result.page.padEnd(8)} ${line.join(' | ')}`);
  if (result.failing.length > 0) {
    console.log(`         below 90: ${result.failing.join(', ')}`);
  }
}
console.log(`Reports: ${reports}`);
process.exit(ok ? 0 : 1);
