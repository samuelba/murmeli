import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import { checkArchiveEntries, fetchAudio, installArchive, listAudioFiles, packAudio, sha256File } from './audio-asset.mjs'

const created = []
after(() => created.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })))

function makeDir(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'murmeli-audio-test-'))
  created.push(root)
  for (const [relative, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    fs.writeFileSync(path.join(root, relative), content)
  }
  return root
}

function manifest(version, locales) {
  return JSON.stringify({ version, locales })
}

const RENDERED = {
  'manifest.json': manifest('abc123', {
    'de-CH': { a: { file: 'de-CH/0001.opus', status: 'ok' } },
    'en-US': {
      b: { file: 'en-US/0002.opus', status: 'ok' },
      c: { file: 'en-US/0004.opus', status: 'flagged' },
    },
  }),
  'de-CH/0001.opus': 'de clip',
  'de-CH/0003.opus': 'orphan from an older render',
  'en-US/0002.opus': 'en clip',
  'en-US/0004.opus': 'flagged clip',
  'review.html': '<html></html>',
  '.cache/x.wav': 'cache',
}

test('lists the manifest and its playable clips, nothing else', () => {
  const dir = makeDir(RENDERED)
  assert.deepEqual(listAudioFiles(dir), ['manifest.json', 'de-CH/0001.opus', 'en-US/0002.opus'])
})

test('refuses a folder without a manifest', () => {
  const dir = makeDir({ 'de-CH/0001.opus': 'clip' })
  assert.throws(() => listAudioFiles(dir), /manifest\.json/)
})

test('refuses a manifest that points to a missing or unsafe file', () => {
  const missing = makeDir({ 'manifest.json': manifest('v', { 'de-CH': { a: { file: 'de-CH/0001.opus', status: 'ok' } } }) })
  assert.throws(() => listAudioFiles(missing), /missing/)
  const unsafe = makeDir({ 'manifest.json': manifest('v', { 'de-CH': { a: { file: '../run.sh', status: 'ok' } } }) })
  assert.throws(() => listAudioFiles(unsafe), /Unexpected/)
})

test('accepts only manifest and locale clips in an archive', () => {
  assert.doesNotThrow(() =>
    checkArchiveEntries(['manifest.json', 'de-CH/', 'de-CH/a.opus', './en-US/b.opus', 'en-US/']),
  )
  for (const bad of ['../x.opus', '/etc/passwd', 'de-CH/../../x.opus', 'fr-FR/a.opus', 'de-CH/sub/a.opus', 'run.sh']) {
    assert.throws(() => checkArchiveEntries(['manifest.json', bad]), /Unexpected/, bad)
  }
  assert.throws(() => checkArchiveEntries(['de-CH/a.opus']), /manifest\.json/)
})

test('packs and installs a set', () => {
  const source = makeDir(RENDERED)
  const archive = path.join(makeDir({}), 'audio.tar.gz')
  packAudio(source, archive)
  const target = path.join(makeDir({}), 'audio')
  installArchive(archive, target)
  assert.deepEqual(listAudioFiles(target), ['manifest.json', 'de-CH/0001.opus', 'en-US/0002.opus'])
  assert.equal(fs.existsSync(path.join(target, 'review.html')), false)
  assert.equal(fs.readFileSync(path.join(target, 'de-CH/0001.opus'), 'utf8'), 'de clip')
})

test('installing replaces the previous set', () => {
  const archive = path.join(makeDir({}), 'audio.tar.gz')
  packAudio(makeDir(RENDERED), archive)
  const target = path.join(makeDir({}), 'audio')
  fs.mkdirSync(path.join(target, 'de-CH'), { recursive: true })
  fs.writeFileSync(path.join(target, 'de-CH/old.opus'), 'old')
  installArchive(archive, target)
  assert.equal(fs.existsSync(path.join(target, 'de-CH/old.opus')), false)
  assert.equal(fs.readdirSync(path.dirname(target)).length, 1)
})

function lockFor(archive, version = 'abc123') {
  return { version, url: 'https://example.invalid/audio.tar.gz', sha256: sha256File(archive) }
}

test('fetches, verifies and installs the locked set', async () => {
  const archive = path.join(makeDir({}), 'audio.tar.gz')
  packAudio(makeDir(RENDERED), archive)
  const target = path.join(makeDir({}), 'audio')
  const urls = []
  const result = await fetchAudio(lockFor(archive), target, async (url) => {
    urls.push(url)
    return fs.readFileSync(archive)
  })
  assert.equal(result, 'installed')
  assert.deepEqual(urls, ['https://example.invalid/audio.tar.gz'])
  assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8')).version, 'abc123')
})

test('skips the download when the installed set has the locked version', async () => {
  const archive = path.join(makeDir({}), 'audio.tar.gz')
  packAudio(makeDir(RENDERED), archive)
  const target = path.join(makeDir({}), 'audio')
  installArchive(archive, target)
  const result = await fetchAudio(lockFor(archive), target, async () => assert.fail('downloaded'))
  assert.equal(result, 'up-to-date')
})

test('rejects a download with the wrong checksum and keeps the current set', async () => {
  const archive = path.join(makeDir({}), 'audio.tar.gz')
  packAudio(makeDir(RENDERED), archive)
  const target = path.join(makeDir({}), 'audio')
  installArchive(archive, target)
  const lock = { ...lockFor(archive, 'newer'), sha256: '0'.repeat(64) }
  await assert.rejects(fetchAudio(lock, target, async () => fs.readFileSync(archive)), /checksum/)
  assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8')).version, 'abc123')
})
