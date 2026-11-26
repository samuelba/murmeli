import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { findEszett } from './check-no-eszett.mjs'

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'murmeli-eszett-'))
  for (const [relative, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    fs.writeFileSync(path.join(root, relative), content)
  }
  return root
}

test('reports file and line of every ß', () => {
  const root = makeRoot({
    'frontend/public/i18n/de-CH.json': '{\n  "greeting": "Grüss dich",\n  "street": "Strasse",\n  "bad": "Grüße"\n}\n',
    'content/math/world.yaml': 'title: Fuß\n',
  })
  const hits = findEszett(root).map(({ file, line }) => `${file}:${line}`).sort()
  assert.deepEqual(hits, ['content/math/world.yaml:1', 'frontend/public/i18n/de-CH.json:4'])
})

test('ignores node_modules and unknown extensions', () => {
  const root = makeRoot({
    'frontend/src/node_modules/x/de.json': '"Straße"',
    'content/audio/clip.opus': 'Straße',
    'frontend/src/app/i18n.spec.ts': "expect(text).not.toContain('ß')",
  })
  assert.deepEqual(findEszett(root), [])
})
