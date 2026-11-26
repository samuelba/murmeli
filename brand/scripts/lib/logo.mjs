import { C, svg, sparkle } from './common.mjs';

const P = 'mu-logo';
const ol = (w) => `stroke="${C.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

const defs = (tile) => `<defs>
  <linearGradient id="${P}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.skyTop}"/><stop offset="1" stop-color="${C.skyBottom}"/></linearGradient>
  <linearGradient id="${P}-meadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.meadowTop}"/><stop offset="1" stop-color="${C.meadowBottom}"/></linearGradient>
  <linearGradient id="${P}-fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.furTop}"/><stop offset="1" stop-color="${C.furBottom}"/></linearGradient>
  <clipPath id="${P}-tile-clip">${tile}</clipPath>
  <clipPath id="${P}-burrow-clip"><path d="M0 0H128V93H86A22 7 0 0 1 42 93H0Z"/></clipPath>
</defs>`;

const mountains = `<g class="${P}-mountains">
  <path d="M-4 90L40 50L56 64L78 38L132 92Z" fill="${C.mountain}"/>
  <path d="M33.4 57L40 50L48 57L44.5 55.4L40.5 58.2L37 55.4Z" fill="${C.snow}"/>
  <path d="M69.5 48L78 38L88 48L83.6 46.2L79.4 49.6L74.6 46.2Z" fill="${C.snow}"/>
</g>`;

const hill = (x0 = 0, x1 = 128) => `<g class="${P}-hill">
  <path d="M${x0} 92C30 74 98 70 ${x1} 86V128H${x0}Z" fill="url(#${P}-meadow)"/>
  <path d="M19 104l2-5 2 5 2-4 1.5 4M101 106l2-5 2 5 2-4 1.5 4" fill="none" stroke="${C.meadowDark}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</g>`;

const signpost = `<g class="${P}-signpost">
  <rect x="21.5" y="63" width="3.4" height="24" rx="1.2" fill="${C.pole}" ${ol(1.4)}/>
  <path d="M13 62.5H31.5L35.5 66.5L31.5 70.5H13Z" fill="${C.sun}" ${ol(1.6)}/>
  <path d="M16.5 66.5H28" stroke="${C.ink}" stroke-width="1.4" stroke-linecap="round"/>
</g>`;

const burrowBack = `<g class="${P}-burrow">
  <ellipse cx="64" cy="95" rx="27" ry="9.5" fill="${C.dirt}" ${ol(2)}/>
  <ellipse cx="64" cy="93" rx="22" ry="7" fill="${C.hole}"/>
</g>`;

const burrowLip = `<path class="${P}-lip" d="M37 95A27 9.5 0 0 0 91 95L86 93A22 7 0 0 1 42 93Z" fill="${C.dirt}" ${ol(2)}/>`;

const eye = (x, cls) =>
  `<g class="${cls}"><ellipse cx="${x}" cy="55" rx="3.6" ry="4.4" fill="${C.ink}"/><circle cx="${x - 1.1}" cy="53.4" r="1.4" fill="${C.white}"/></g>`;

const pencil = `<g class="${P}-pencil">
  <g transform="translate(79 86) rotate(-60)">
    <path d="M-8 -3.5H23L32 0L23 3.5H-8Z" fill="${C.sun}"/>
    <rect x="-8" y="-3.5" width="5.5" height="7" fill="${C.eraser}"/>
    <rect x="-2.5" y="-3.5" width="4" height="7" fill="${C.ferrule}"/>
    <rect x="1.5" y="1.2" width="21.5" height="2.3" fill="${C.sunShade}"/>
    <path d="M23 -3.5L32 0L23 3.5Z" fill="${C.pencilWood}"/>
    <path d="M28.6 -1.2L32 0L28.6 1.2Z" fill="${C.ink}"/>
    <path d="M-8 -3.5H23L32 0L23 3.5H-8Z" fill="none" ${ol(1.6)}/>
    <path d="M-2.5 -3.5V3.5M1.5 -3.5V3.5M23 -3.5V3.5" fill="none" stroke="${C.ink}" stroke-width="1.1"/>
  </g>
  <ellipse cx="83.2" cy="79.6" rx="5.2" ry="4.6" fill="${C.furDark}" ${ol(1.8)}/>
</g>`;

const marmot = (animated) => `<g class="${P}-marmot">
  <path d="M44 104C43 82 50 68 64 68C78 68 85 82 84 104Z" fill="url(#${P}-fur)" ${ol(2.4)}/>
  <ellipse cx="64" cy="90" rx="12.5" ry="12" fill="${C.cream}"/>
  <circle cx="44" cy="45" r="5.6" fill="${C.fur}" ${ol(2.4)}/>
  <circle cx="84" cy="45" r="5.6" fill="${C.fur}" ${ol(2.4)}/>
  <circle cx="44.6" cy="45.4" r="2.6" fill="${C.furDark}"/>
  <circle cx="83.4" cy="45.4" r="2.6" fill="${C.furDark}"/>
  <path d="M64 38C79 38 88 46 88 58C88 70 77 76 64 76C51 76 40 70 40 58C40 46 49 38 64 38Z" fill="url(#${P}-fur)"/>
  <path d="M40.6 54C42 44 51 38.6 64 38.6C77 38.6 86 44 87.4 54C81 48.5 72 47.5 64 51.5C56 47.5 47 48.5 40.6 54Z" fill="${C.crown}"/>
  <path d="M64 38C79 38 88 46 88 58C88 70 77 76 64 76C51 76 40 70 40 58C40 46 49 38 64 38Z" fill="none" ${ol(2.4)}/>
  <ellipse cx="64" cy="65.5" rx="11.5" ry="8.4" fill="${C.cream}"/>
  <ellipse cx="49" cy="64.5" rx="4.2" ry="2.6" fill="${C.cheek}" opacity=".6"/>
  <ellipse cx="79" cy="64.5" rx="4.2" ry="2.6" fill="${C.cheek}" opacity=".6"/>
  ${eye(55.5, `${P}-eye ${P}-eye-left`)}
  ${eye(72.5, `${P}-eye ${P}-eye-right`)}
  ${animated ? `<path class="${P}-wink" d="M68.6 56Q72.5 51.4 76.4 56" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>` : ''}
  <path d="M60.6 60.4Q64 58.6 67.4 60.4Q66.6 63.6 64 64Q61.4 63.6 60.6 60.4Z" fill="${C.ink}"/>
  <path d="M64 64V65.6M58.8 66.2Q61.6 68.8 64 65.6Q66.4 68.8 69.2 66.2" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="61.6" y="67" width="4.8" height="4.4" rx="1" fill="${C.white}" ${ol(1.2)}/>
  <path d="M64 67V71.4" stroke="${C.ink}" stroke-width=".9"/>
  <ellipse cx="51.5" cy="97.5" rx="5.6" ry="4.4" fill="${C.furDark}" ${ol(1.8)}/>
  ${pencil}
</g>`;

const sparkleEl = `<g class="${P}-sparkle">${sparkle(93, 37, 5.4, C.sun)}${sparkle(100.5, 45, 2.4, C.white)}</g>`;

const style = `<style>
  .mu-logo-marmot { transform-box: view-box; transform-origin: 64px 100px; }
  .mu-logo-eye { transform-box: fill-box; transform-origin: 50% 50%; }
  .mu-logo-pencil { transform-box: view-box; transform-origin: 83px 80px; }
  .mu-logo-sparkle { transform-box: fill-box; transform-origin: 50% 50%; opacity: 0; }
  .mu-logo-wink { opacity: 0; }
  .mu-logo--animated .mu-logo-marmot { animation: mu-logo-pop 5s cubic-bezier(.45,0,.25,1) infinite; }
  .mu-logo--animated .mu-logo-eye-left { animation: mu-logo-blink 5s linear infinite; }
  .mu-logo--animated .mu-logo-eye-right { animation: mu-logo-eye-right 5s linear infinite; }
  .mu-logo--animated .mu-logo-wink { animation: mu-logo-wink 5s step-end infinite; }
  .mu-logo--animated .mu-logo-sparkle { animation: mu-logo-sparkle 5s ease-out infinite; }
  .mu-logo--animated .mu-logo-pencil { animation: mu-logo-wiggle 5s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .mu-logo--animated .mu-logo-marmot, .mu-logo--animated .mu-logo-eye-left,
    .mu-logo--animated .mu-logo-eye-right, .mu-logo--animated .mu-logo-wink,
    .mu-logo--animated .mu-logo-sparkle, .mu-logo--animated .mu-logo-pencil { animation: none; }
  }
  @keyframes mu-logo-pop {
    0%, 6% { transform: translateY(72px) scale(.94, 1.06); }
    14% { transform: translateY(-6px) scale(.9, 1.12); }
    19% { transform: translateY(0) scale(1.1, .88); }
    24% { transform: translateY(0) scale(.97, 1.04); }
    29%, 78% { transform: translateY(0) scale(1, 1); }
    83% { transform: translateY(2px) scale(1.08, .9); }
    91%, 100% { transform: translateY(72px) scale(.92, 1.1); }
  }
  @keyframes mu-logo-blink {
    0%, 32% { transform: scaleY(1); }
    33.5% { transform: scaleY(.1); }
    35%, 68% { transform: scaleY(1); }
    69.5% { transform: scaleY(.1); }
    71%, 100% { transform: scaleY(1); }
  }
  @keyframes mu-logo-eye-right {
    0%, 32% { transform: scaleY(1); opacity: 1; }
    33.5% { transform: scaleY(.1); opacity: 1; }
    35%, 44% { transform: scaleY(1); opacity: 1; }
    46% { transform: scaleY(.1); opacity: 1; }
    46.1%, 61.9% { transform: scaleY(.1); opacity: 0; }
    62% { transform: scaleY(.1); opacity: 1; }
    64%, 68% { transform: scaleY(1); opacity: 1; }
    69.5% { transform: scaleY(.1); opacity: 1; }
    71%, 100% { transform: scaleY(1); opacity: 1; }
  }
  @keyframes mu-logo-wink {
    0% { opacity: 0; }
    46% { opacity: 1; }
    62% { opacity: 0; }
  }
  @keyframes mu-logo-sparkle {
    0%, 46% { opacity: 0; transform: scale(0) rotate(0deg); }
    51% { opacity: 1; transform: scale(1.2) rotate(45deg); }
    56% { opacity: 1; transform: scale(.9) rotate(70deg); }
    62%, 100% { opacity: 0; transform: scale(0) rotate(110deg); }
  }
  @keyframes mu-logo-wiggle {
    0%, 44% { transform: rotate(0deg); }
    48% { transform: rotate(-12deg); }
    52% { transform: rotate(10deg); }
    56% { transform: rotate(-8deg); }
    60% { transform: rotate(5deg); }
    64%, 100% { transform: rotate(0deg); }
  }
</style>`;

const TILE = '<rect x="8" y="8" width="112" height="112" rx="30"/>';

const scene = (animated) => `
  <g clip-path="url(#${P}-tile-clip)">
    <rect x="8" y="8" width="112" height="112" fill="url(#${P}-sky)"/>
    ${mountains}
    ${hill(8, 120)}
    ${signpost}
    ${burrowBack}
    <g clip-path="url(#${P}-burrow-clip)">${marmot(animated)}</g>
    ${burrowLip}
    ${animated ? sparkleEl : ''}
  </g>`;

export const markBody = (animated = false) => `${animated ? style : ''}
${defs(TILE)}
<rect class="${P}-shadow" x="8" y="12" width="112" height="112" rx="30" fill="#000" opacity=".18"/>
<g class="${P}-tile">${scene(animated)}
</g>`;

export const logoMark = ({ animated = false } = {}) =>
  svg('0 0 128 128', markBody(animated), { cls: animated ? `${P} ${P}--animated` : P, label: 'Murmeli' });

export const appIcon = () =>
  svg(
    '0 0 128 128',
    `${defs('<rect width="128" height="128"/>')}
<g clip-path="url(#${P}-tile-clip)">
  <rect width="128" height="128" fill="url(#${P}-sky)"/>
  ${mountains}
  ${hill(0, 128)}
</g>
<g transform="translate(64 70) scale(.8) translate(-64 -70)">
  ${signpost}
  ${burrowBack}
  <g clip-path="url(#${P}-burrow-clip)">${marmot(false)}</g>
  ${burrowLip}
</g>`,
    { label: 'Murmeli' },
  );

export const favicon = () =>
  svg(
    '0 0 64 64',
    `<defs>
  <linearGradient id="mu-fav-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.skyTop}"/><stop offset="1" stop-color="${C.skyBottom}"/></linearGradient>
  <linearGradient id="mu-fav-fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.furTop}"/><stop offset="1" stop-color="${C.furBottom}"/></linearGradient>
  <clipPath id="mu-fav-tile"><rect width="64" height="64" rx="15"/></clipPath>
</defs>
<g clip-path="url(#mu-fav-tile)">
  <rect width="64" height="64" fill="url(#mu-fav-sky)"/>
  <path d="M0 52C18 46 46 46 64 52V64H0Z" fill="${C.meadowBottom}"/>
  <circle cx="10.5" cy="22" r="6.2" fill="${C.fur}" ${ol(2.6)}/>
  <circle cx="53.5" cy="22" r="6.2" fill="${C.fur}" ${ol(2.6)}/>
  <circle cx="11.2" cy="22.6" r="2.9" fill="${C.furDark}"/>
  <circle cx="52.8" cy="22.6" r="2.9" fill="${C.furDark}"/>
  <path d="M32 11C48 11 59 21 59 35C59 50 46 62 32 62C18 62 5 50 5 35C5 21 16 11 32 11Z" fill="url(#mu-fav-fur)"/>
  <path d="M5.7 29C8 18 18 11.6 32 11.6C46 11.6 56 18 58.3 29C50.5 23.5 40.5 22.6 32 27C23.5 22.6 13.5 23.5 5.7 29Z" fill="${C.crown}"/>
  <path d="M32 11C48 11 59 21 59 35C59 50 46 62 32 62C18 62 5 50 5 35C5 21 16 11 32 11Z" fill="none" ${ol(2.6)}/>
  <ellipse cx="32" cy="46" rx="13.5" ry="10" fill="${C.cream}"/>
  <ellipse cx="22" cy="33.5" rx="4.4" ry="5.4" fill="${C.ink}"/>
  <ellipse cx="42" cy="33.5" rx="4.4" ry="5.4" fill="${C.ink}"/>
  <circle cx="20.6" cy="31.6" r="1.7" fill="${C.white}"/>
  <circle cx="40.6" cy="31.6" r="1.7" fill="${C.white}"/>
  <path d="M27.6 40.2Q32 37.8 36.4 40.2Q35.4 44.2 32 44.8Q28.6 44.2 27.6 40.2Z" fill="${C.ink}"/>
  <path d="M32 44.8V46.6M26.4 47.4Q29.4 50.2 32 46.6Q34.6 50.2 37.6 47.4" fill="none" stroke="${C.ink}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="29" y="48" width="6" height="5.4" rx="1.2" fill="${C.white}" ${ol(1.4)}/>
  <ellipse cx="15" cy="43" rx="4" ry="2.4" fill="${C.cheek}" opacity=".7"/>
  <ellipse cx="49" cy="43" rx="4" ry="2.4" fill="${C.cheek}" opacity=".7"/>
</g>`,
    { label: 'Murmeli' },
  );
