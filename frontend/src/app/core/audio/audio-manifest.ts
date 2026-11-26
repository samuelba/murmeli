/** One clip of the TTS pipeline manifest (tools/audio, `out/manifest.json`). */
export interface Clip {
  readonly file: string;
  readonly durationMs: number | null;
}

/** locale → manifest text → clip. */
export type ClipIndex = ReadonlyMap<string, ReadonlyMap<string, Clip>>;

export const EMPTY_INDEX: ClipIndex = new Map();

const SAFE_FILE = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:opus|ogg|mp3|m4a|wav)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The manifest `version` (a content hash), used to bust caches of re-rendered clips. */
export function manifestVersion(manifest: unknown): string | null {
  const version = isRecord(manifest) ? manifest['version'] : null;
  return typeof version === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(version) ? version : null;
}

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function clipOf(entry: unknown): [string, Clip] | null {
  if (!isRecord(entry) || typeof entry['text'] !== 'string' || typeof entry['file'] !== 'string') {
    return null;
  }
  if (!SAFE_FILE.test(entry['file']) || entry['status'] === 'flagged') {
    return null;
  }
  const duration = entry['durationMs'];
  return [
    normalizeText(entry['text']),
    {
      file: entry['file'],
      durationMs: typeof duration === 'number' && duration > 0 ? duration : null,
    },
  ];
}

/**
 * Builds the text → clip lookup per locale from `{ version, locales: { <locale>: { <key>: {
 * text, file, durationMs, status } } } }`. Entries with an unsafe or missing file are dropped;
 * anything that is not a manifest yields an empty index.
 */
export function indexManifest(manifest: unknown): ClipIndex {
  const locales = isRecord(manifest) ? manifest['locales'] : null;
  if (!isRecord(locales)) {
    return EMPTY_INDEX;
  }
  const index = new Map<string, Map<string, Clip>>();
  for (const [locale, entries] of Object.entries(locales)) {
    if (!isRecord(entries)) {
      continue;
    }
    const clips = new Map<string, Clip>();
    for (const entry of Object.values(entries)) {
      const clip = clipOf(entry);
      if (clip && !clips.has(clip[0])) {
        clips.set(...clip);
      }
    }
    if (clips.size > 0) {
      index.set(locale, clips);
    }
  }
  return index;
}
