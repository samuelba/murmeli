export const MAX_SVG_BYTES = 256 * 1024;

const FORBIDDEN: readonly [RegExp, string][] = [
  [/<!DOCTYPE/i, 'contains a DOCTYPE'],
  [/<!ENTITY/i, 'declares an entity'],
  [/<script\b/i, 'contains a <script> element'],
  [/<foreignObject\b/i, 'contains a <foreignObject> element'],
  [
    /<(iframe|object|embed|image|audio|video|a)\b/i,
    'contains an embedding or link element',
  ],
  [/\son[a-z]+\s*=/i, 'contains an event handler attribute'],
  [/javascript:/i, 'contains a javascript: URL'],
  [/\bdata:/i, 'contains a data: URL'],
  [/@import/i, 'contains a CSS @import'],
  [/<\?xml-stylesheet/i, 'references an external stylesheet'],
];

export function checkSvg(text: string): string[] {
  const problems: string[] = [];
  if (Buffer.byteLength(text, 'utf8') > MAX_SVG_BYTES) {
    problems.push(`is larger than ${MAX_SVG_BYTES} bytes`);
  }
  if (!/<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(text)) {
    problems.push('has no <svg> root with the SVG namespace');
  }
  for (const [pattern, message] of FORBIDDEN) {
    if (pattern.test(text)) {
      problems.push(message);
    }
  }
  for (const match of text.matchAll(
    /(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi,
  )) {
    if (!match[1]?.startsWith('#')) {
      problems.push(`has an external reference "${match[1]}"`);
    }
  }
  for (const match of text.matchAll(/url\(\s*["']?([^"')\s]*)/gi)) {
    if (!match[1]?.startsWith('#')) {
      problems.push(`has an external url(${match[1]})`);
    }
  }
  return problems;
}
