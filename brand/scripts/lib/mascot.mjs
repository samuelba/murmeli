import { C, svg, outline, limb, sparkle } from './common.mjs';

const P = 'mu-mascot';
const ARM = '#B27848';
const ol = outline(3.5);
const line = (w = 3.5) => `fill="none" stroke="${C.ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

const defs = `<defs><linearGradient id="${P}-fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.furTop}"/><stop offset="1" stop-color="${C.furBottom}"/></linearGradient></defs>`;
const FUR = `url(#${P}-fur)`;

const HEAD = 'M0 -38C30 -38 48 -22 48 2C48 26 26 38 0 38C-26 38 -48 26 -48 2C-48 -22 -30 -38 0 -38Z';

const eyesBy = {
  open: () =>
    [-17, 17]
      .map(
        (x) =>
          `<ellipse cx="${x}" cy="-4" rx="7.2" ry="8.8" fill="${C.ink}"/><circle cx="${x - 2.3}" cy="-7.4" r="2.8" fill="${C.white}"/><circle cx="${x + 2.4}" cy="-0.6" r="1.2" fill="${C.white}"/>`,
      )
      .join(''),
  up: () =>
    [-16, 18]
      .map(
        (x) =>
          `<ellipse cx="${x}" cy="-6" rx="6.6" ry="8.2" fill="${C.ink}"/><circle cx="${x + 1.6}" cy="-9.6" r="2.6" fill="${C.white}"/>`,
      )
      .join(''),
  happy: () => `<path d="M-25 -2Q-17 -13 -9 -2M9 -2Q17 -13 25 -2" ${line(4)}/>`,
  sleep: () => `<path d="M-25 -5Q-17 3 -9 -5M9 -5Q17 3 25 -5" ${line(3.6)}/>`,
};

const browsBy = {
  none: '',
  think: `<path d="M-26 -20Q-18 -27 -9 -22M9 -19Q17 -21 25 -17" ${line(3.2)}/>`,
  kind: `<path d="M-25 -19Q-17 -24 -9 -20M9 -20Q17 -24 25 -19" ${line(3.2)}/>`,
};

const teeth = (x = 0, y = 20) =>
  `<rect x="${x - 4.8}" y="${y}" width="9.6" height="8.8" rx="2" fill="${C.white}" ${outline(2.4)}/><path d="M${x} ${y}V${y + 8.8}" stroke="${C.ink}" stroke-width="1.6"/>`;

const mouthBy = {
  default: () => `<path d="M0 14V17.2M-10.4 18.4Q-4.8 23.6 0 17.2Q4.8 23.6 10.4 18.4" ${line(3.2)}/>${teeth()}`,
  smile: () => `<path d="M0 14V17.2M-13 17Q-6 25 0 17.2Q6 25 13 17" ${line(3.2)}/>${teeth()}`,
  hmm: () => `<path d="M1 14V17M-7 20Q2 17 11 20" ${line(3.2)}/>${teeth(2, 19.6)}`,
  open: () =>
    `<path d="M-12 17Q0 19 12 17Q11 33 0 33Q-11 33 -12 17Z" fill="${C.mouth}" ${outline(3.2)}/>` +
    `<path d="M-6.5 29.6Q0 24 6.5 29.6Q0 33 -6.5 29.6Z" fill="${C.tongue}"/>` +
    `<path d="M-5 17.8H5V23Q5 24.4 3.6 24.4H-3.6Q-5 24.4 -5 23Z" fill="${C.white}" ${outline(2)}/><path d="M0 18V24.4" stroke="${C.ink}" stroke-width="1.4"/>` +
    `<path d="M0 14V17" ${line(3.2)}/>`,
};

export const head = ({ eyes = 'open', brows = 'none', mouth = 'default', transform = 'translate(100 74)', extra = '' } = {}) => `<g class="${P}-head" transform="${transform}">
  <circle cx="-40" cy="-24" r="11" fill="${C.fur}" ${ol}/><circle cx="40" cy="-24" r="11" fill="${C.fur}" ${ol}/>
  <circle cx="-38.8" cy="-23.2" r="5.2" fill="${C.furDark}"/><circle cx="38.8" cy="-23.2" r="5.2" fill="${C.furDark}"/>
  <path d="${HEAD}" fill="${FUR}"/>
  <path d="M-46.8 -6C-44 -26 -26 -36.8 0 -36.8C26 -36.8 44 -26 46.8 -6C34 -17 16 -19 0 -11C-16 -19 -34 -17 -46.8 -6Z" fill="${C.crown}"/>
  <path d="${HEAD}" fill="none" ${ol}/>
  <ellipse cx="0" cy="17" rx="23" ry="16.8" fill="${C.cream}"/>
  <ellipse cx="-30" cy="15" rx="8.4" ry="5.2" fill="${C.cheek}" opacity=".6"/><ellipse cx="30" cy="15" rx="8.4" ry="5.2" fill="${C.cheek}" opacity=".6"/>
  <g class="${P}-eyes">${eyesBy[eyes]()}</g>
  ${browsBy[brows]}
  <path d="M-6.8 6.8Q0 3.2 6.8 6.8Q5.2 13.2 0 14Q-5.2 13.2 -6.8 6.8Z" fill="${C.ink}"/><ellipse cx="-2" cy="7" rx="2" ry="1.1" fill="${C.white}" opacity=".6"/>
  ${mouthBy[mouth]()}
  ${extra}
</g>`;

const shadow = (cx = 100, cy = 190, rx = 56) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="6" fill="${C.ink}" opacity=".12"/>`;
const tail = `<path d="M142 166C156 170 170 162 172 149C173.5 139 163 135 157.5 142C153 148 150 155 140 159Z" fill="${C.furDark}" ${ol}/>`;
const body = `<path d="M100 96C136 96 152 124 152 150C152 176 130 188 100 188C70 188 48 176 48 150C48 124 64 96 100 96Z" fill="${FUR}" ${ol}/>
<ellipse cx="100" cy="150" rx="31" ry="31" fill="${C.cream}"/>`;
const feet = `<ellipse cx="76" cy="185" rx="15" ry="7.5" fill="${C.furDark}" ${ol}/><ellipse cx="124" cy="185" rx="15" ry="7.5" fill="${C.furDark}" ${ol}/>
<path d="M70 181.5V185.5M76 180.5V185.5M82 181.5V185.5M118 181.5V185.5M124 180.5V185.5M130 181.5V185.5" ${line(2)}/>`;
const paw = (x, y, r = 8.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.furDark}" ${ol}/>`;
const arm = (d, x, y) => limb(d, ARM, 13, 3.5) + paw(x, y);

const standing = (arms, face, extras = '') => `${defs}
${shadow()}
<g class="${P}-body">
${tail}
${body}
${feet}
${head(face)}
${arms}
</g>
${extras}`;

const confetti = [
  ['rect', 28, 46, C.sun, 20], ['rect', 58, 18, C.skyDeep, -30], ['circle', 84, 10, C.coral], ['rect', 120, 14, C.meadowTop, 40],
  ['circle', 146, 26, C.purple], ['rect', 176, 44, C.coral, -20], ['circle', 22, 100, C.meadowTop], ['rect', 182, 104, C.sun, 60],
  ['circle', 30, 150, C.sky], ['rect', 172, 150, C.purple, 15], ['circle', 186, 70, C.sun], ['circle', 14, 70, C.coral],
]
  .map(([k, x, y, fill, rot]) =>
    k === 'rect'
      ? `<rect x="${x - 3.5}" y="${y - 6}" width="7" height="12" rx="2" fill="${fill}" ${outline(2)} transform="rotate(${rot} ${x} ${y})"/>`
      : `<circle cx="${x}" cy="${y}" r="4.5" fill="${fill}" ${outline(2)}/>`,
  )
  .join('\n');

const questionMark = `<g class="${P}-question">
  <path d="M152 31Q152 14 166 14Q180 14 180 27Q180 36 171 40Q166 42.5 166 49" fill="none" stroke="${C.ink}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M152 31Q152 14 166 14Q180 14 180 27Q180 36 171 40Q166 42.5 166 49" fill="none" stroke="${C.skyDeep}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="166" cy="63" r="5.5" fill="${C.skyDeep}" ${outline(3)}/>
</g>`;

const thumb = `<path d="M149.5 106V93A5 5 0 0 1 159.5 93V106Z" fill="${C.furDark}" ${ol}/>
<rect x="144" y="103" width="22" height="20" rx="8" fill="${C.furDark}" ${ol}/>
<path d="M148.5 110H161.5M148.5 116H161.5" ${line(2)}/>`;

const zzz = [
  [126, 96, 11],
  [146, 66, 15],
  [168, 32, 19],
]
  .map(([x, y, s]) => {
    const d = `M${x} ${y}H${x + s}L${x} ${y + s}H${x + s}`;
    const w = s > 14 ? 5 : 4;
    return `<g class="${P}-z"><path d="${d}" ${line(w + 6)}/><path d="${d}" fill="none" stroke="${C.zzz}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  })
  .join('\n');

const thinkingBody = () =>
  standing(
    arm('M66 120Q58 142 74 150', 76, 151) + arm('M134 122Q150 150 121 115', 120, 114),
    { eyes: 'up', brows: 'think', mouth: 'hmm' },
  );

export const poses = {
  happy: () =>
    standing(
      arm('M66 120Q58 142 74 150', 76, 151) +
        arm('M134 120Q156 110 160 84', 160, 82) +
        `<path d="M173 66Q181 76 177 90M181 56Q194 73 187 97" fill="none" stroke="${C.skyDeep}" stroke-width="3.5" stroke-linecap="round"/>`,
      { mouth: 'smile' },
    ),
  thinking: () => thinkingBody() + questionMark,
  cheering: () =>
    standing(
      arm('M68 122Q46 104 42 76', 42, 74) + arm('M132 122Q154 104 158 76', 158, 74),
      { eyes: 'happy', mouth: 'open' },
      confetti,
    ),
  encouraging: () =>
    standing(
      arm('M66 120Q58 142 74 150', 76, 151) + limb('M134 122Q152 128 152 114', ARM, 13, 3.5) + thumb,
      { brows: 'kind', mouth: 'smile' },
      sparkle(178, 78, 8) + sparkle(186, 98, 3.5, C.white),
    ),
  sleeping: () => `${defs}
${shadow(100, 184, 72)}
<g class="${P}-body">
<path d="M36 170C30 134 66 106 110 108C150 110 172 136 166 166C164 178 150 182 100 182C56 182 40 180 36 170Z" fill="${FUR}" ${ol}/>
<path d="M164 160C162 182 128 186 108 180C98 177 98 168 108 168C126 172 144 168 152 156C156 150 165 152 164 160Z" fill="${C.furDark}" ${ol}/>
${head({
  eyes: 'sleep',
  mouth: 'default',
  transform: 'translate(78 128) rotate(-8) scale(.86)',
  extra: `<circle cx="15" cy="15" r="7.5" fill="#D9F1FF" stroke="#7DB9E3" stroke-width="2" opacity=".9"/><circle cx="12.5" cy="12.5" r="2" fill="${C.white}"/>`,
})}
<ellipse cx="64" cy="165" rx="10.5" ry="7" fill="${C.furDark}" ${ol}/>
<ellipse cx="89" cy="166" rx="10.5" ry="7" fill="${C.furDark}" ${ol}/>
</g>
${zzz}`,
};

export const mascotSvg = (name) => svg('0 0 200 200', poses[name](), { cls: `${P} ${P}--${name}`, label: `Murmeli ${name}` });

export const thinkingAnimated = () =>
  svg(
    '0 0 200 200',
    `<style>
  .mu-mascot-body { transform-box: view-box; transform-origin: 100px 190px; }
  .mu-mascot-question { transform-box: fill-box; transform-origin: 50% 100%; }
  .mu-mascot-eyes { transform-box: fill-box; transform-origin: 50% 50%; }
  .mu-mascot--animated .mu-mascot-body { animation: mu-mascot-bob 2.4s cubic-bezier(.45,0,.25,1) infinite; }
  .mu-mascot--animated .mu-mascot-question { animation: mu-mascot-ponder 1.2s ease-in-out infinite; }
  .mu-mascot--animated .mu-mascot-eyes { animation: mu-mascot-blink 4.8s linear infinite; }
  @media (prefers-reduced-motion: reduce) {
    .mu-mascot--animated .mu-mascot-body, .mu-mascot--animated .mu-mascot-question,
    .mu-mascot--animated .mu-mascot-eyes { animation: none; }
  }
  @keyframes mu-mascot-bob {
    0%, 100% { transform: translateY(0) scale(1, 1); }
    50% { transform: translateY(-5px) scale(.99, 1.02); }
  }
  @keyframes mu-mascot-ponder {
    0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
    50% { opacity: .45; transform: scale(1.12) rotate(8deg); }
  }
  @keyframes mu-mascot-blink {
    0%, 44% { transform: scaleY(1); }
    46% { transform: scaleY(.1); }
    48%, 100% { transform: scaleY(1); }
  }
</style>
${thinkingBody()}
${questionMark}`,
    { cls: `${P} ${P}--thinking ${P}--animated`, label: 'Murmeli thinking' },
  );
