import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkComposeInit, extractConfigContent } from './check-compose-init.mjs'

test('extracts and unescapes an inline config', () => {
  const compose = 'configs:\n  demo:\n    content: |\n      echo "$${HOME}"\n\n      done\nnetworks:\n'
  assert.equal(extractConfigContent(compose, 'demo'), 'echo "${HOME}"\n\ndone\n')
})

test('returns null for a missing config', () => {
  assert.equal(extractConfigContent('configs: {}\n', 'demo'), null)
})

test('the repository copy is in sync', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  assert.equal(checkComposeInit(root), true)
})
