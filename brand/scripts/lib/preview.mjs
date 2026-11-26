const uri = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
const img = (s, w, alt = '', style = '') => `<img src="${uri(s)}" width="${w}" height="${w}" alt="${alt}"${style ? ` style="${style}"` : ''}>`;

export const FRAMES = [
  [0.3, 'hidden'],
  [0.7, 'stretch'],
  [0.95, 'squash'],
  [1.68, 'blink'],
  [2.6, 'wink + sparkle'],
  [4.15, 'anticipation'],
  [4.6, 'ducked'],
];

export const pausedAt = (animatedSvg, t) =>
  animatedSvg.replace('</style>', `  * { animation-play-state: paused !important; animation-delay: -${t}s !important; }\n</style>`);

const COMBOS = [
  ['marmot', 'crown'],
  ['fox', 'sunglasses'],
  ['cow', 'party-hat'],
  ['penguin', 'beanie'],
  ['sheep', 'flower'],
  ['cat', 'headphones'],
  ['panda', 'bow'],
  ['owl', 'wizard-hat'],
];

export const previewHtml = ({ css, logo, mascots, avatars, accessories, backgrounds, tokens, report }) => {
  const swatch = (name, hex, on) =>
    `<div class="sw"><span style="background:${hex};color:${on ?? 'inherit'}">${on ? 'Aa' : ''}</span><b>${name}</b><code>${hex}</code></div>`;
  const themeSwatches = (theme) =>
    Object.entries(tokens.themes[theme])
      .filter(([k]) => !k.startsWith('on-') && k !== 'shadow-color')
      .map(([k, v]) => swatch(k, v, tokens.themes[theme][`on-${k}`]))
      .join('');
  const rows = report
    .map(
      (r) =>
        `<tr class="${r.pass ? '' : 'fail'}"><td>${r.theme}</td><td><span class="chip" style="background:${r.bgHex};color:${r.fgHex}">Aa</span> ${r.fg} on ${r.bg}</td><td><code>${r.fgHex}</code> / <code>${r.bgHex}</code></td><td><b>${r.ratio.toFixed(2)}:1</b></td><td>${r.pass ? 'pass' : 'FAIL'} (${r.note})</td></tr>`,
    )
    .join('');
  const avatarGrid = avatars
    .map(
      (a, i) =>
        `<figure>${img(a.svg, 104, a.name['en-US'], `background:${backgrounds[i % backgrounds.length]}`)}<figcaption>${a.name['de-CH']}<br><small>${a.name['en-US']}</small></figcaption></figure>`,
    )
    .join('');
  const byId = (list, id) => list.find((x) => x.id === id);
  const combos = COMBOS.map(
    ([an, ac], i) =>
      `<figure><div class="stack" style="background:${backgrounds[(i * 3) % backgrounds.length]}">${img(byId(avatars, an).svg, 120)}${img(byId(accessories, ac).svg, 120)}</div><figcaption>${an} + ${ac}</figcaption></figure>`,
  ).join('');
  const accRow = accessories.map((a) => `<figure>${img(a.svg, 96, a.name['en-US'], 'background:var(--mu-color-surface-raised);border-radius:50%')}<figcaption>${a.name['de-CH']}<br><small>${a.name['en-US']}</small></figcaption></figure>`).join('');
  const mascotRow = mascots.map((m) => `<figure>${img(m.svg, 176, m.id)}<figcaption>${m.id}</figcaption></figure>`).join('');
  const frames = FRAMES.map(([t, label]) => `<figure>${img(pausedAt(logo.animated, t), 112, label)}<figcaption>${t}s<br><small>${label}</small></figcaption></figure>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Murmeli brand preview</title>
<link rel="icon" href="${uri(logo.favicon)}">
<style>
${css}
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--mu-font-ui); background: var(--mu-color-bg); color: var(--mu-color-text); line-height: 1.45; }
header { display: flex; align-items: center; gap: var(--mu-space-4); padding: var(--mu-space-4) var(--mu-space-5); background: var(--mu-color-surface); box-shadow: var(--mu-shadow-md); position: sticky; top: 0; z-index: 2; }
header h1 { font-size: var(--mu-font-size-lg); margin: 0; flex: 1; }
main { max-width: 1180px; margin: 0 auto; padding: var(--mu-space-5); }
section { background: var(--mu-color-surface); border-radius: var(--mu-radius-chunky); padding: var(--mu-space-5); margin-bottom: var(--mu-space-5); box-shadow: var(--mu-shadow-sm); }
h2 { margin: 0 0 var(--mu-space-4); font-size: var(--mu-font-size-xl); }
h3 { margin: var(--mu-space-5) 0 var(--mu-space-3); color: var(--mu-color-text-muted); font-size: var(--mu-font-size-md); text-transform: uppercase; letter-spacing: .06em; }
.row { display: flex; flex-wrap: wrap; gap: var(--mu-space-4); align-items: flex-end; }
.panel { display: flex; flex-wrap: wrap; gap: var(--mu-space-5); align-items: center; padding: var(--mu-space-5); border-radius: var(--mu-radius-rounded); }
.panel.light { background: #FBF7EE; color: #1E2A3E; } .panel.dark { background: #0F1A2E; color: #F3F6FB; }
figure { margin: 0; text-align: center; font-size: var(--mu-font-size-sm); }
figcaption small, small { color: var(--mu-color-text-muted); }
.avatars { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: var(--mu-space-4); }
.avatars img { border-radius: 50%; }
.stack { position: relative; width: 120px; height: 120px; border-radius: 50%; }
.stack img { position: absolute; inset: 0; }
.sws { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--mu-space-3); }
.sw { display: grid; grid-template-columns: 44px 1fr; grid-template-rows: auto auto; column-gap: var(--mu-space-2); align-items: center; font-size: var(--mu-font-size-sm); }
.sw span { grid-row: span 2; width: 44px; height: 44px; border-radius: var(--mu-radius-md); display: grid; place-items: center; font-weight: 800; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .12); }
code { font-size: .8rem; color: var(--mu-color-text-muted); }
table { border-collapse: collapse; width: 100%; font-size: var(--mu-font-size-sm); }
td { padding: 6px 8px; border-bottom: 1px solid var(--mu-color-border); }
tr.fail td { background: var(--mu-color-error); color: var(--mu-color-on-error); }
.chip { display: inline-block; padding: 2px 8px; border-radius: var(--mu-radius-sm); font-weight: 800; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .12); }
.btn { min-height: var(--mu-touch-kid); min-width: var(--mu-touch-kid); padding: 0 var(--mu-space-5); border: 0; border-radius: var(--mu-radius-rounded); font: 800 var(--mu-font-size-lg) var(--mu-font-ui); cursor: pointer; transition: transform var(--mu-duration-fast) var(--mu-ease-brand); }
.btn:active { transform: translateY(3px); }
.btn:focus-visible { outline: 4px solid var(--mu-color-focus-ring); outline-offset: 3px; }
.btn.primary { background: var(--mu-color-primary); color: var(--mu-color-on-primary); box-shadow: var(--mu-shadow-chunky); }
.btn.success { background: var(--mu-color-success); color: var(--mu-color-on-success); box-shadow: 0 5px 0 rgb(0 0 0 / .25); }
.btn.error { background: var(--mu-color-error); color: var(--mu-color-on-error); box-shadow: 0 5px 0 rgb(0 0 0 / .25); }
.btn.math { background: var(--mu-color-math); color: var(--mu-color-on-math); }
.btn.reading { background: var(--mu-color-reading); color: var(--mu-color-on-reading); }
.btn.writing { background: var(--mu-color-writing); color: var(--mu-color-on-writing); }
.btn.adult { min-height: var(--mu-touch-adult); font-size: var(--mu-font-size-md); background: var(--mu-color-surface-raised); color: var(--mu-color-text); box-shadow: inset 0 0 0 2px var(--mu-color-border); }
#theme { min-height: var(--mu-touch-adult); padding: 0 var(--mu-space-4); border-radius: var(--mu-radius-pill); border: 2px solid var(--mu-color-border); background: var(--mu-color-surface-raised); color: var(--mu-color-text); font: 700 var(--mu-font-size-md) var(--mu-font-ui); cursor: pointer; }
.mask { width: 128px; height: 128px; border-radius: 50%; overflow: hidden; outline: 2px dashed var(--mu-color-text-muted); outline-offset: 2px; }
.learn { font-family: var(--mu-font-learn); font-size: var(--mu-font-size-learn); }
</style>
</head>
<body>
<header>${img(logo.static, 48, 'Murmeli')}<h1>Murmeli brand preview</h1><button id="theme" type="button" aria-pressed="false">Dark mode</button></header>
<main>
<section>
  <h2>Logo</h2>
  <div class="panel light">${img(logo.animated, 160, 'animated')}${img(logo.static, 160, 'static')}${img(logo.static, 64)}${img(logo.static, 32)}<img src="${uri(logo.wordmark)}" height="80" alt="wordmark"></div>
  <div class="panel dark" style="margin-top:12px">${img(logo.animated, 160, 'animated')}${img(logo.static, 160, 'static')}${img(logo.static, 64)}${img(logo.static, 32)}<img src="${uri(logo.wordmarkDark)}" height="80" alt="wordmark on dark"></div>
  <h3>Animation keyframes (5 s loop, paused with negative animation-delay)</h3>
  <div class="row">${frames}</div>
  <h3>Favicon and app icon</h3>
  <div class="row">${img(logo.favicon, 16)}${img(logo.favicon, 32)}${img(logo.favicon, 64)}${img(logo.favicon, 128)}<div class="mask">${img(logo.appIcon, 128)}</div>${img(logo.appIcon, 128, '', 'border-radius:28px')}</div>
</section>
<section>
  <h2>Mascot</h2>
  <div class="row">${mascotRow}<figure>${img(logo.thinking, 176, 'thinking animated')}<figcaption>thinking-animated</figcaption></figure></div>
</section>
<section>
  <h2>Avatars</h2>
  <div class="avatars">${avatarGrid}</div>
  <h3>Accessories</h3>
  <div class="avatars">${accRow}</div>
  <h3>Combinations</h3>
  <div class="avatars">${combos}</div>
  <h3>Backgrounds</h3>
  <div class="row">${backgrounds.map((b) => `<span class="chip" style="background:${b};width:56px;height:56px;border-radius:50%"></span>`).join('')}</div>
</section>
<section>
  <h2>Tokens</h2>
  <div class="row" style="margin-bottom:24px">
    <button class="btn primary" type="button">Los!</button><button class="btn success" type="button">Super!</button><button class="btn error" type="button">Nochmal</button>
    <button class="btn math" type="button">1 + 2</button><button class="btn reading" type="button">Lesen</button><button class="btn writing" type="button">Schreiben</button><button class="btn adult" type="button">Eltern</button>
  </div>
  <p class="learn">Aa Bb Mm Ll 1 2 3</p>
  <h3>Brand</h3>
  <div class="sws">${Object.entries(tokens.brand).map(([k, v]) => swatch(k, v)).join('')}</div>
  <h3>Light theme</h3>
  <div class="sws">${themeSwatches('light')}</div>
  <h3>Dark theme</h3>
  <div class="sws">${themeSwatches('dark')}</div>
  <h3>Contrast (WCAG 2.x)</h3>
  <table>${rows}</table>
</section>
</main>
<script>
  const btn = document.getElementById('theme');
  const root = document.documentElement;
  const sync = () => { const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches); btn.textContent = dark ? 'Light mode' : 'Dark mode'; btn.setAttribute('aria-pressed', String(dark)); return dark; };
  btn.addEventListener('click', () => { root.dataset.theme = sync() ? 'light' : 'dark'; sync(); });
  sync();
</script>
</body>
</html>
`;
};
