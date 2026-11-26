import { C, svg, outline, limb, sparkle } from './common.mjs';

const O = outline(3);
const o = (w) => outline(w);

const items = [
  {
    id: 'party-hat',
    name: { 'de-CH': 'Partyhut', 'en-US': 'Party hat' },
    draw: () => `<g transform="rotate(16 60 34)">
  <clipPath id="mu-acc-party-clip"><path d="M45 34L60 2L75 34Z"/></clipPath>
  <path d="M45 34L60 2L75 34Z" fill="${C.sky}"/>
  <g clip-path="url(#mu-acc-party-clip)" fill="${C.sun}"><path d="M40 22L80 12V18L40 28Z"/><path d="M40 34L80 24V30L40 40Z"/></g>
  <path d="M45 34L60 2L75 34Z" fill="none" ${O}/>
  <rect x="42" y="31" width="36" height="6" rx="3" fill="${C.coral}" ${o(2.5)}/>
  <circle cx="60" cy="3" r="6" fill="${C.coral}" ${o(2.5)}/>
</g>`,
  },
  {
    id: 'crown',
    name: { 'de-CH': 'Krone', 'en-US': 'Crown' },
    draw: () => `<path d="M37 36L35 13L48 25L60 8L72 25L85 13L83 36Z" fill="${C.sun}" ${O}/>
<path d="M37 30H83" stroke="${C.sunShade}" stroke-width="2.5"/>
<circle cx="35" cy="12" r="3.6" fill="${C.sun}" ${o(2.2)}/><circle cx="60" cy="7" r="3.6" fill="${C.sun}" ${o(2.2)}/><circle cx="85" cy="12" r="3.6" fill="${C.sun}" ${o(2.2)}/>
<circle cx="48" cy="31" r="3" fill="#E5484D" ${o(1.8)}/><circle cx="60" cy="30" r="3.6" fill="${C.skyDeep}" ${o(1.8)}/><circle cx="72" cy="31" r="3" fill="#E5484D" ${o(1.8)}/>`,
  },
  {
    id: 'sunglasses',
    name: { 'de-CH': 'Sonnenbrille', 'en-US': 'Sunglasses' },
    draw: () => `<path d="M30 58L17 54M90 58L103 54" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>
<path d="M55 58Q60 54 65 58" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>
<rect x="29" y="51" width="27" height="19" rx="8" fill="#2E2A3A" ${O}/><rect x="64" y="51" width="27" height="19" rx="8" fill="#2E2A3A" ${O}/>
<path d="M35 64L42 55M41 66L46 59.5M70 64L77 55M76 66L81 59.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>`,
  },
  {
    id: 'beanie',
    name: { 'de-CH': 'Wollmütze', 'en-US': 'Wool hat' },
    draw: () => `<path d="M24 38C24 12 96 12 96 38Z" fill="#D52B1E" ${O}/>
<path d="M44 18Q48 26 46 34M60 15V34M76 18Q72 26 74 34" fill="none" stroke="#A81F16" stroke-width="2" stroke-linecap="round" opacity=".7"/>
<rect x="20" y="32" width="80" height="13" rx="6.5" fill="#B5231A" ${O}/>
<path d="M29 35.5V41.5M37 35.5V41.5M45 35.5V41.5M53 35.5V41.5M61 35.5V41.5M69 35.5V41.5M77 35.5V41.5M85 35.5V41.5M93 35.5V41.5" stroke="#7E1710" stroke-width="2" stroke-linecap="round" opacity=".6"/>
<circle cx="60" cy="11" r="8" fill="#fff" ${O}/>`,
  },
  {
    id: 'flower',
    name: { 'de-CH': 'Blume', 'en-US': 'Flower' },
    draw: () => {
      const petals = Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return `<circle cx="${(30 + 8 * Math.cos(a)).toFixed(2)}" cy="${(28 + 8 * Math.sin(a)).toFixed(2)}" r="6.5" fill="#FF8FB1" ${o(2.4)}/>`;
      }).join('');
      return `<path d="M36 36Q46 34 50 42Q40 44 36 36Z" fill="${C.meadowTop}" ${o(2.2)}/>${petals}<circle cx="30" cy="28" r="5" fill="${C.sun}" ${o(2.2)}/>`;
    },
  },
  {
    id: 'headphones',
    name: { 'de-CH': 'Kopfhörer', 'en-US': 'Headphones' },
    draw: () => `${limb('M17 60C15 22 105 22 103 60', C.skyDeep, 6, 3)}
<rect x="7" y="48" width="18" height="28" rx="8" fill="${C.skyDeep}" ${O}/><rect x="95" y="48" width="18" height="28" rx="8" fill="${C.skyDeep}" ${O}/>
<rect x="19" y="52" width="8" height="20" rx="4" fill="#1F2A44" ${o(2)}/><rect x="93" y="52" width="8" height="20" rx="4" fill="#1F2A44" ${o(2)}/>`,
  },
  {
    id: 'bow',
    name: { 'de-CH': 'Masche', 'en-US': 'Bow' },
    draw: () => `<path d="M86 30L80 44L86 41L89 45Z" fill="#E0457A" ${o(2.2)}/>
<path d="M86 28C76 16 68 20 68 28C68 36 76 40 86 28Z" fill="#FF5C8A" ${O}/>
<path d="M86 28C96 16 104 20 104 28C104 36 96 40 86 28Z" fill="#FF5C8A" ${O}/>
<g fill="#fff" opacity=".85"><circle cx="75" cy="25" r="1.8"/><circle cx="76" cy="32" r="1.4"/><circle cx="97" cy="25" r="1.8"/><circle cx="96" cy="32" r="1.4"/></g>
<circle cx="86" cy="28" r="5" fill="#E0457A" ${o(2.5)}/>`,
  },
  {
    id: 'wizard-hat',
    name: { 'de-CH': 'Zauberhut', 'en-US': 'Wizard hat' },
    draw: () => `<path d="M38 34L55 8Q60 1 69 3Q62 6 61 12L82 34Z" fill="#6E4BC4" ${O}/>
<ellipse cx="60" cy="35" rx="34" ry="7" fill="#5A3BA8" ${O}/>
${sparkle(57, 23, 5.5)}${sparkle(69, 28, 3)}${sparkle(62, 13, 2.4, '#fff')}`,
  },
];

export const accessoryList = items;
export const accessorySvg = (a) => svg('0 0 120 120', a.draw(), { cls: `mu-accessory mu-accessory--${a.id}` });
