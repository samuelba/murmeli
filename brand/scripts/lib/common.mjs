export const C = {
  ink: '#3B2A20',
  furTop: '#C99262',
  furBottom: '#A66C3C',
  fur: '#B67D4A',
  furDark: '#7F4F2C',
  crown: '#93603A',
  cream: '#F8E7CC',
  cheek: '#F2917F',
  mouth: '#8C3B33',
  tongue: '#F58B95',
  white: '#FFFFFF',
  skyTop: '#BEE5FA',
  skyBottom: '#EAF7FD',
  mountain: '#A9C8E2',
  snow: '#FFFFFF',
  meadowTop: '#79C84F',
  meadowBottom: '#3F9B3A',
  meadowDark: '#2F7D32',
  dirt: '#8A5A35',
  hole: '#2A1C14',
  sun: '#F7C600',
  sunShade: '#E0A800',
  pencilWood: '#F3CF9C',
  ferrule: '#C9CED6',
  eraser: '#F28AA0',
  pole: '#8D96A3',
  sky: '#5BB8E8',
  skyDeep: '#2B8CD6',
  coral: '#FF8A73',
  purple: '#9B6BE8',
  zzz: '#8EC5FF',
};

export const svg = (viewBox, body, { cls, label, extra = '' } = {}) => {
  const a11y = label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"';
  const klass = cls ? ` class="${cls}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${klass}${a11y}${extra}>\n${body.trim()}\n</svg>\n`;
};

export const outline = (w = 3) =>
  `stroke="${C.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

export const furGradient = (id, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${C.furTop}"/><stop offset="1" stop-color="${C.furBottom}"/></linearGradient>`;

export const limb = (d, color, w = 13, edge = 3) =>
  `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${w + edge * 2}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const sparkle = (cx, cy, r, fill = C.sun, cls = '') => {
  const k = r * 0.28;
  const d = `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
  const c = cls ? ` class="${cls}"` : '';
  return `<path${c} d="${d}" fill="${fill}" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
};

export const round = (n) => Math.round(n * 100) / 100;
