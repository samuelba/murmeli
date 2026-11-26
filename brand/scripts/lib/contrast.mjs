const channel = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT = 4.5;
const UI = 3;

export const PAIRS = [
  ['text', 'bg', TEXT],
  ['text', 'surface', TEXT],
  ['text', 'surface-raised', TEXT],
  ['text-muted', 'bg', TEXT],
  ['text-muted', 'surface', TEXT],
  ['text-muted', 'surface-raised', TEXT],
  ['on-primary', 'primary', TEXT],
  ['on-primary', 'primary-hover', TEXT],
  ['on-secondary', 'secondary', TEXT],
  ['on-success', 'success', TEXT],
  ['on-warning', 'warning', TEXT],
  ['on-error', 'error', TEXT],
  ['on-math', 'math', TEXT],
  ['on-reading', 'reading', TEXT],
  ['on-writing', 'writing', TEXT],
  ['focus-ring', 'bg', UI],
  ['focus-ring', 'surface', UI],
  ['success', 'error', 1.8, 'luminance gap (colorblind safety)'],
];

export const contrastReport = (themes) =>
  Object.entries(themes).flatMap(([theme, t]) =>
    PAIRS.map(([fg, bg, min, note]) => {
      const r = ratio(t[fg], t[bg]);
      return { theme, fg, bg, fgHex: t[fg], bgHex: t[bg], ratio: Math.round(r * 100) / 100, min, pass: r >= min, note: note ?? (min === UI ? 'non-text 3:1' : 'text AA 4.5:1') };
    }),
  );
