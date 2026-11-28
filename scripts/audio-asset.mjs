#!/usr/bin/env node
// The rendered narration is not in the repository. It is published as a GitHub release asset,
// and content/audio.lock.json pins the asset by URL and sha256.
//   node scripts/audio-asset.mjs fetch                     download the locked set into content/audio
//   node scripts/audio-asset.mjs publish [dir] [--dry-run] pack dir (default tools/audio/out), upload it
//                                                          as a release and update the lock
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(SCRIPT_DIR, '..')
const LOCK_FILE = path.join(ROOT, 'content/audio.lock.json')
const AUDIO_DIR = path.join(ROOT, 'content/audio')
const DEFAULT_SOURCE = path.join(ROOT, 'tools/audio/out')
const LOCALES = ['de-CH', 'en-US']
const CLIP = /^[A-Za-z0-9_-]+\.(?:opus|ogg|mp3|m4a|wav)$/
const VERSION = /^[A-Za-z0-9._-]+$/

function isClipPath(entry) {
  const parts = entry.split('/')
  return parts.length === 2 && LOCALES.includes(parts[0]) && CLIP.test(parts[1])
}

function isRegularFile(file) {
  return fs.existsSync(file) && fs.lstatSync(file).isFile()
}

function readManifest(dir) {
  const file = path.join(dir, 'manifest.json')
  if (!isRegularFile(file)) throw new Error(`No manifest.json in ${dir}`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** The manifest and every clip it references that the app plays (not flagged), as relative paths. */
export function listAudioFiles(dir) {
  const manifest = readManifest(dir)
  const clips = new Set()
  for (const entries of Object.values(manifest.locales ?? {})) {
    for (const entry of Object.values(entries)) {
      if (entry.status === 'flagged') continue
      if (!isClipPath(entry.file)) throw new Error(`Unexpected clip path in the manifest: ${entry.file}`)
      if (!isRegularFile(path.join(dir, entry.file))) throw new Error(`The manifest references a missing clip: ${entry.file}`)
      clips.add(entry.file)
    }
  }
  return ['manifest.json', ...[...clips].sort()]
}

export function checkArchiveEntries(entries) {
  const normalized = entries.map((entry) => entry.replace(/^\.\//, ''))
  for (const entry of normalized) {
    if (entry === 'manifest.json' || LOCALES.some((locale) => entry === `${locale}/`) || isClipPath(entry)) continue
    throw new Error(`Unexpected entry in the audio archive: ${entry}`)
  }
  if (!normalized.includes('manifest.json')) throw new Error('The audio archive has no manifest.json')
  return normalized.filter((entry) => !entry.endsWith('/'))
}

export function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function listArchive(archive) {
  return checkArchiveEntries(execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).split('\n').filter(Boolean))
}

export function packAudio(dir, archive) {
  const files = listAudioFiles(dir)
  execFileSync('tar', ['-czf', archive, '-C', dir, '-T', '-'], {
    input: `${files.join('\n')}\n`,
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  })
  listArchive(archive)
  return files
}

/** Extracts into a staging folder next to target and swaps it in, so target is never half written. */
export function installArchive(archive, target) {
  const files = listArchive(archive)
  const staging = `${target}.tmp-${process.pid}`
  const previous = `${target}.old-${process.pid}`
  fs.rmSync(staging, { recursive: true, force: true })
  fs.mkdirSync(staging, { recursive: true })
  try {
    execFileSync('tar', ['-xzf', archive, '-C', staging, '--no-same-owner'])
    if (listAudioFiles(staging).length !== files.length) {
      throw new Error('The audio archive holds files the manifest does not reference')
    }
    if (fs.existsSync(target)) fs.renameSync(target, previous)
    fs.renameSync(staging, target)
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true })
    if (fs.existsSync(previous) && !fs.existsSync(target)) fs.renameSync(previous, target)
    throw error
  }
  fs.rmSync(previous, { recursive: true, force: true })
}

function installedVersion(target) {
  try {
    return readManifest(target).version
  } catch {
    return undefined
  }
}

async function download(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Downloading ${url} failed: HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

/** @returns {Promise<'installed' | 'up-to-date'>} */
export async function fetchAudio(lock, target, get = download) {
  if (installedVersion(target) === lock.version) return 'up-to-date'
  const data = Buffer.from(await get(lock.url))
  const actual = createHash('sha256').update(data).digest('hex')
  if (actual !== lock.sha256) throw new Error(`The audio archive checksum is ${actual}, the lock expects ${lock.sha256}`)
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'murmeli-audio-'))
  try {
    const archive = path.join(workDir, 'audio.tar.gz')
    fs.writeFileSync(archive, data)
    installArchive(archive, target)
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
  return 'installed'
}

async function fetchCommand() {
  if (!fs.existsSync(LOCK_FILE)) {
    console.log(`No ${path.relative(ROOT, LOCK_FILE)}: narration stays off.`)
    return
  }
  const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'))
  const result = await fetchAudio(lock, AUDIO_DIR)
  console.log(result === 'installed' ? `Installed narration ${lock.version} in content/audio.` : `Narration ${lock.version} is up to date.`)
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
}

async function publishCommand(source, dryRun) {
  const manifest = readManifest(source)
  if (typeof manifest.version !== 'string' || !VERSION.test(manifest.version)) {
    throw new Error(`The manifest version must match ${VERSION}`)
  }
  const flagged = Object.values(manifest.locales ?? {})
    .flatMap((entries) => Object.values(entries))
    .filter((entry) => entry.status === 'flagged').length
  if (flagged > 0) console.warn(`Warning: ${flagged} flagged clips are left out. Run ./run.sh check in tools/audio.`)

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'murmeli-audio-'))
  try {
    return await publishFrom(source, manifest.version, workDir, dryRun)
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}

/** Asset names of the release, or undefined when there is no release with this tag. */
function releaseAssets(repo, tag) {
  try {
    const output = execFileSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'assets', '-q', '.assets[].name'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output.split('\n').filter(Boolean)
  } catch {
    return undefined
  }
}

async function publishFrom(source, version, workDir, dryRun) {
  const tag = `audio-${version}`
  const asset = `murmeli-audio-${version}.tar.gz`
  const archive = path.join(workDir, asset)
  const files = packAudio(source, archive)
  const size = (fs.statSync(archive).size / 1024 / 1024).toFixed(1)
  console.log(`Packed ${files.length - 1} clips (${size} MB).`)
  if (dryRun) {
    console.log('Dry run: nothing was uploaded.')
    return
  }

  const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim()
  const url = `https://github.com/${repo}/releases/download/${tag}/${asset}`
  const existing = releaseAssets(repo, tag)
  if (existing === undefined) {
    gh([
      'release', 'create', tag, archive,
      '--repo', repo,
      '--title', `Narration audio ${version}`,
      '--notes', `Pre-rendered narration (${files.length - 1} clips). The frontend image build downloads it through content/audio.lock.json.`,
      '--latest=false',
    ])
  } else if (!existing.includes(asset)) {
    gh(['release', 'upload', tag, archive, '--repo', repo])
  } else {
    console.log(`${tag} is already published; locking its asset instead of replacing it.`)
    fs.writeFileSync(archive, await download(url))
  }
  installArchive(archive, AUDIO_DIR)
  const lock = { version, url, sha256: sha256File(archive) }
  fs.writeFileSync(LOCK_FILE, `${JSON.stringify(lock, null, 2)}\n`)
  console.log(`Locked ${tag} in ${path.relative(ROOT, LOCK_FILE)}. Commit the lock file.`)
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const [command, ...rest] = process.argv.slice(2)
  const positional = rest.filter((arg) => !arg.startsWith('--'))
  try {
    if (command === 'fetch') await fetchCommand()
    else if (command === 'publish') await publishCommand(path.resolve(positional[0] ?? DEFAULT_SOURCE), rest.includes('--dry-run'))
    else {
      console.error('Usage: audio-asset.mjs fetch | publish [dir] [--dry-run]')
      process.exit(2)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
