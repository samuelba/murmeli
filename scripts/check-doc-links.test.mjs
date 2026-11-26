import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { findBrokenLinks, slugify } from './check-doc-links.mjs'

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'murmeli-links-'))
  for (const [relative, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    fs.writeFileSync(path.join(root, relative), content)
  }
  return root
}

test('slugify matches GitHub-style anchors', () => {
  assert.equal(slugify('Reverse proxy & `TRUSTED_PROXIES`'), 'reverse-proxy--trusted_proxies')
})

test('reports missing files and anchors, ignores external links and code blocks', () => {
  const root = makeRoot({
    'README.md': '[ok](docs/site/a.md#first-step) [web](https://example.com)\n',
    'docs/site/a.md': '# First step\n[gone](b.md)\n[bad anchor](#nope)\n```\n[in code](missing.md)\n```\n',
  })
  const broken = findBrokenLinks(root).map(({ file, link, reason }) => `${reason}:${file}:${link}`)
  assert.deepEqual(broken.sort(), ['anchor:docs/site/a.md:#nope', 'missing:docs/site/a.md:b.md'])
})

test('the repository docs have no broken links', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  assert.deepEqual(findBrokenLinks(root), [])
})
