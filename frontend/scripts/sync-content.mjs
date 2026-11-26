#!/usr/bin/env node
// Copies what the player needs from the curriculum package (source of truth: ../content).
//   node scripts/sync-content.mjs          copy pictures, write the learn content JSON
//   node scripts/sync-content.mjs --check  exit 1 when a copy is missing, stale or extra
//   node scripts/sync-content.mjs --audio-from <dir>   take the audio from another folder
//                                          (or MURMELI_AUDIO_DIR), e.g. ../tools/audio/out
// public/pictures/ gets the picture SVGs (and one level of subfolders, e.g. money/) with their
// LICENSE and NOTICE.md. The JSON holds the
// picture words (alt texts), the hint texts and the feedback phrases, exactly as the audio
// manifest knows them. The rendered narration (content/audio: manifest.json + <locale>/*.opus)
// goes to public/audio/ when it exists; that copy is gitignored and not checked. It is staged
// in public/audio.tmp-<pid> and swapped in with a rename, so public/audio is never half copied.
// Without ../content (an old frontend-only build context) both modes skip.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const content = resolve(frontend, '..', 'content');
const PICTURES_TARGET = 'public/pictures';
const DATA_TARGET = 'src/app/learn/content/learn-content.json';
const AUDIO_TARGET = 'public/audio';
const LOCALES = ['de-CH', 'en-US'];
const AUDIO_FILE = /^[A-Za-z0-9_-]+\.(?:opus|ogg|mp3|m4a|wav)$/;

function audioSource() {
  const flag = process.argv.indexOf('--audio-from');
  const dir = flag >= 0 ? process.argv[flag + 1] : process.env['MURMELI_AUDIO_DIR'];
  return resolve(dir ? resolve(process.cwd(), dir) : join(content, 'audio'));
}

async function syncAudio() {
  const source = audioSource();
  if (!existsSync(join(source, 'manifest.json'))) {
    console.log(`No audio at ${source} (manifest.json missing): narration stays off.`);
    return;
  }
  const target = join(frontend, AUDIO_TARGET);
  const staging = `${target}.tmp-${process.pid}`;
  const previous = `${target}.old-${process.pid}`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  let count = 0;
  try {
    for (const locale of LOCALES) {
      if (!existsSync(join(source, locale))) {
        continue;
      }
      await mkdir(join(staging, locale), { recursive: true });
      for (const name of await readdir(join(source, locale))) {
        if (AUDIO_FILE.test(name)) {
          await copyFile(join(source, locale, name), join(staging, locale, name));
          count += 1;
        }
      }
    }
    // The manifest goes last, so a staging folder with a manifest is always complete.
    await copyFile(join(source, 'manifest.json'), join(staging, 'manifest.json'));
    if (existsSync(target)) {
      await rename(target, previous);
    }
    await rename(staging, target);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (existsSync(previous) && !existsSync(target)) {
      await rename(previous, target);
    }
    throw error;
  }
  await rm(previous, { recursive: true, force: true });
  console.log(`Copied the audio manifest and ${count} clips from ${source}.`);
}

const PICTURE_FILE = /\.svg$|^LICENSE$|^NOTICE\.md$/;
const PICTURE_DIR = /^[a-z0-9-]+$/;

/** Picture files as paths relative to the folder, including one level of subfolders (money/). */
async function listPictures(root) {
  if (!existsSync(root)) {
    return [];
  }
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && PICTURE_FILE.test(entry.name)) {
      files.push(entry.name);
    } else if (entry.isDirectory() && PICTURE_DIR.test(entry.name)) {
      for (const inner of await readdir(join(root, entry.name), { withFileTypes: true })) {
        files.push(inner.isFile() ? `${entry.name}/${inner.name}` : `${entry.name}/${inner.name}/`);
      }
    } else {
      files.push(entry.isDirectory() ? `${entry.name}/` : entry.name);
    }
  }
  return files.sort();
}

async function pictureFiles() {
  return (await listPictures(join(content, 'pictures'))).filter(
    (name) => !name.endsWith('/') && PICTURE_FILE.test(name.split('/').at(-1)),
  );
}

function localized(text) {
  return Object.fromEntries(LOCALES.filter((locale) => text?.[locale]).map((l) => [l, text[l]]));
}

async function learnContent() {
  const { HINTS, loadContent } = await import('@murmeli/content');
  const loaded = loadContent(content);
  const pictures = Object.fromEntries(
    Object.entries(loaded.pictures)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, picture]) => [id, localized(picture.words)]),
  );
  const hints = Object.fromEntries(
    Object.entries(HINTS)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, text]) => [key, localized(text)]),
  );
  const feedback = Object.fromEntries(
    LOCALES.map((locale) => [locale, loaded.lexicons[locale]?.feedback ?? {}]),
  );
  return `${JSON.stringify({ pictures, hints, feedback }, null, 2)}\n`;
}

async function hash(path) {
  if (!existsSync(path)) {
    return null;
  }
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

async function check(files) {
  const stale = [];
  for (const name of files) {
    const target = join(PICTURES_TARGET, name);
    if ((await hash(join(content, 'pictures', name))) !== (await hash(join(frontend, target)))) {
      stale.push(`${target} (from content/pictures/${name})`);
    }
  }
  const copied = await listPictures(join(frontend, PICTURES_TARGET));
  copied
    .filter((name) => !files.includes(name))
    .forEach((name) => stale.push(`${PICTURES_TARGET}/${name} (no longer in content/pictures)`));
  const data = join(frontend, DATA_TARGET);
  const current = existsSync(data) ? await readFile(data, 'utf8') : null;
  if (current !== (await learnContent())) {
    stale.push(`${DATA_TARGET} (from content pictures.yaml, hints and lexicon)`);
  }
  if (stale.length > 0) {
    console.error(
      `Content copies are out of date. Run "npm run content:sync".\n${stale.join('\n')}`,
    );
    process.exit(1);
  }
  console.log(`Content copies are in sync (${files.length} picture files).`);
}

async function sync(files) {
  const target = join(frontend, PICTURES_TARGET);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  for (const name of files) {
    await mkdir(dirname(join(target, name)), { recursive: true });
    await copyFile(join(content, 'pictures', name), join(target, name));
  }
  await mkdir(dirname(join(frontend, DATA_TARGET)), { recursive: true });
  await writeFile(join(frontend, DATA_TARGET), await learnContent());
  await syncAudio();
  console.log(
    `Copied ${files.length} picture files and wrote ${DATA_TARGET} in ${relative(process.cwd(), frontend) || '.'}.`,
  );
}

if (!existsSync(content)) {
  console.log(`Skipping: ${content} not found.`);
  process.exit(0);
}

const files = await pictureFiles();
await (process.argv.includes('--check') ? check(files) : sync(files));
