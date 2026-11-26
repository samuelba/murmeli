import { TRANSLATIONS } from '../../../testing/i18n';

type Tree = Record<string, unknown>;

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      entries.set(path, value);
    } else {
      flatten(value as Tree, path).forEach((leaf, leafPath) => entries.set(leafPath, leaf));
    }
  }
  return entries;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort();
}

describe('translation files', () => {
  const de = flatten(TRANSLATIONS['de-CH']);
  const en = flatten(TRANSLATIONS['en-US']);

  it('have identical key sets', () => {
    expect([...de.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it('never use the Eszett in de-CH', () => {
    const offending = [...de].filter(([, text]) => text.includes('\u00DF')).map(([key]) => key);
    expect(offending).toEqual([]);
  });

  it('have no empty strings', () => {
    const empty = [...de, ...en].filter(([, text]) => text.trim() === '').map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('use the same placeholders in both languages', () => {
    for (const [key, text] of de) {
      expect(placeholders(en.get(key) ?? ''), key).toEqual(placeholders(text));
    }
  });
});
