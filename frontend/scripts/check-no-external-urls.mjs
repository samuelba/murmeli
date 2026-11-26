#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

// Hosts that appear as plain strings in framework code (XML namespaces, error links,
// URL parsing bases) and never cause a network request. The ALTCHA widget (a Svelte build)
// carries svelte.dev error-doc links and its altcha.org attribution link, which the app hides.
const ALLOWED_HOSTS = new Set([
  'www.w3.org',
  'angular.dev',
  'fake',
  'localhost',
  'svelte.dev',
  'altcha.org',
]);
// The Angular service worker ships unminified, with a source comment linking an Angular issue.
const ALLOWED_IN_FILE = new Map([['ngsw-worker.js', new Set(['github.com'])]]);
const SCANNED = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg']);
const URL_PATTERN = /(?:https?:)?\/\/([a-z0-9.-]+\.[a-z]{2,}|localhost|fake)\b/gi;
// IP literals (v4 and bracketed v6), with or without a scheme.
const IP_PATTERN = /(?:https?:)?\/\/(\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-f:.]+\])/gi;
// Single-label hosts: with a scheme, or protocol-relative right after a quote or url(.
const LABEL_PATTERN = /(?:https?:\/\/|["'`(]\/\/)([a-z][a-z0-9-]*)(?=[/:?#"'`)\s]|$)/gi;
const PATTERNS = [URL_PATTERN, IP_PATTERN, LABEL_PATTERN];

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* files(path);
    } else if (SCANNED.has(extname(entry.name))) {
      yield path;
    }
  }
}

const root = process.argv[2];
if (!root) {
  console.error('Usage: check-no-external-urls.mjs <dist-dir>');
  process.exit(2);
}

const findings = [];
for await (const file of files(root)) {
  const content = await readFile(file, 'utf8');
  for (const match of PATTERNS.flatMap((pattern) => [...content.matchAll(pattern)])) {
    const host = match[1].toLowerCase();
    const allowedHere = ALLOWED_IN_FILE.get(relative(root, file))?.has(host) ?? false;
    if (!ALLOWED_HOSTS.has(host) && !allowedHere) {
      findings.push(`${relative(root, file)}: ${match[0]}`);
    }
  }
}

if (findings.length > 0) {
  console.error(`External hosts found in ${root}:\n${[...new Set(findings)].join('\n')}`);
  process.exit(1);
}
console.log(`No external hosts referenced in ${root}.`);
