const block = (selector, entries, indent = '') =>
  `${indent}${selector} {\n${entries.map(([k, v]) => `${indent}  ${k}: ${v};`).join('\n')}\n${indent}}`;

const themeVars = (theme) =>
  Object.entries(theme).map(([k, v]) => (k === 'shadow-color' ? [`--mu-shadow-color`, v] : [`--mu-color-${k}`, v]));

export const tokensCss = (t) => {
  const root = [
    ...Object.entries(t.brand).map(([k, v]) => [`--mu-color-${k}`, v]),
    ...Object.entries(t.radius).map(([k, v]) => [`--mu-radius-${k}`, v]),
    ...Object.entries(t.space).map(([k, v]) => [`--mu-space-${k}`, v]),
    ...Object.entries(t.shadow).map(([k, v]) => [`--mu-shadow-${k}`, v]),
    ...Object.entries(t.touch).map(([k, v]) => [`--mu-touch-${k}`, v]),
    ...Object.entries(t.font).map(([k, v]) => [`--mu-font-${k}`, v]),
    ...Object.entries(t.motion).map(([k, v]) => [`--mu-${k}`, v]),
    ...t.avatarBackgrounds.map((v, i) => [`--mu-avatar-bg-${i + 1}`, v]),
  ];
  const light = [['color-scheme', 'light'], ...themeVars(t.themes.light)];
  const dark = [['color-scheme', 'dark'], ...themeVars(t.themes.dark)];
  return `/* Murmeli design tokens. Generated from tokens.json by brand/scripts/build.mjs; do not edit by hand. */
${block(':root', root)}

${block(':root,\n[data-theme="light"]', light)}

${block('[data-theme="dark"]', dark)}

@media (prefers-color-scheme: dark) {
${block(':root:not([data-theme="light"])', dark, '  ')}
}

@media (prefers-reduced-motion: reduce) {
${block(':root', [['--mu-duration-fast', '0ms'], ['--mu-duration-base', '0ms'], ['--mu-duration-slow', '0ms']], '  ')}
}
`;
};
