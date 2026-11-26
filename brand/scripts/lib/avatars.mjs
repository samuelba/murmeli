import { C, svg, outline, limb, sparkle, round } from './common.mjs';

const O = outline(3);
const o = (w) => outline(w);
const ln = (w = 3, color = C.ink) => `fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const PINK = '#FF8FA3';
const TONGUE = '#F06C8C';

const shape = (cx, cy, rx, ryT, ryB, k = 0.62) => {
  const r = round;
  return `M${r(cx)} ${r(cy - ryT)}C${r(cx + k * rx)} ${r(cy - ryT)} ${r(cx + rx)} ${r(cy - k * ryT)} ${r(cx + rx)} ${r(cy)}C${r(cx + rx)} ${r(cy + k * ryB)} ${r(cx + k * rx)} ${r(cy + ryB)} ${r(cx)} ${r(cy + ryB)}C${r(cx - k * rx)} ${r(cy + ryB)} ${r(cx - rx)} ${r(cy + k * ryB)} ${r(cx - rx)} ${r(cy)}C${r(cx - rx)} ${r(cy - k * ryT)} ${r(cx - k * rx)} ${r(cy - ryT)} ${r(cx)} ${r(cy - ryT)}Z`;
};
const head = (d, fill) => `<path d="${d}" fill="${fill}" ${O}/>`;
const mirror = (inner) => `<g transform="matrix(-1 0 0 1 120 0)">${inner}</g>`;
const both = (inner) => inner + mirror(inner);

const eye = (x, y, rx = 5, ry = 6) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.ink}"/><circle cx="${round(x - rx * 0.32)}" cy="${round(y - ry * 0.36)}" r="${round(rx * 0.38)}" fill="#fff"/><circle cx="${round(x + rx * 0.34)}" cy="${round(y + ry * 0.3)}" r="${round(rx * 0.16)}" fill="#fff"/>`;
const eyes = (y = 60, l = 46, r = 74, rx, ry) => eye(l, y, rx, ry) + eye(r, y, rx, ry);
const happyEye = (x, y, w = 5.5) => `<path d="M${x - w} ${y + 1.5}Q${x} ${y - 6} ${x + w} ${y + 1.5}" ${ln(3.2)}/>`;
const sleepyEye = (x, y, w = 5.5) => `<path d="M${x - w} ${y - 1.5}Q${x} ${y + 5} ${x + w} ${y - 1.5}" ${ln(3.2)}/>`;
const ringEye = (x, y, r = 6.5, p = 4) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${o(2)}/><circle cx="${x}" cy="${y + 0.5}" r="${p}" fill="${C.ink}"/><circle cx="${x - p * 0.35}" cy="${y - p * 0.3}" r="${p * 0.38}" fill="#fff"/>`;
const cheek = (x, y, rx = 6, ry = 3.6, fill = PINK, op = 0.55) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${op}"/>`;
const cheeks = (y = 76, l = 34, r = 86, rx, ry, fill, op) => cheek(l, y, rx, ry, fill, op) + cheek(r, y, rx, ry, fill, op);
const grin = (x, y, w, h) =>
  `<path d="M${x - w} ${y}Q${x} ${y + h * 1.9} ${x + w} ${y}Q${x} ${y + h * 0.35} ${x - w} ${y}Z" fill="${C.mouth}" ${o(2.5)}/>`;
const tongueDown = (x, y, w = 5.5, h = 13) =>
  `<path d="M${x - w} ${y}V${y + h - w}Q${x - w} ${y + h} ${x} ${y + h}Q${x + w} ${y + h} ${x + w} ${y + h - w}V${y}Z" fill="${TONGUE}" ${o(2.4)}/><path d="M${x} ${y + 2}V${y + h - 5}" ${ln(1.6)} opacity=".45"/>`;
const wMouth = (x, y, w = 7) => `<path d="M${x} ${y - 2}V${y}M${x - w} ${y + 1}Q${x - w / 2} ${y + 4.5} ${x} ${y}Q${x + w / 2} ${y + 4.5} ${x + w} ${y + 1}" ${ln(2.5)}/>`;
const smile = (x, y, w = 8, h = 5) => `<path d="M${x - w} ${y}Q${x} ${y + h * 1.6} ${x + w} ${y}" ${ln(2.8)}/>`;
const buckTeeth = (x, y, w = 8, h = 6.5) =>
  `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="#fff" ${o(2)}/><path d="M${x} ${y}V${y + h}" ${ln(1.4)}/>`;
const whiskers = (y = 80, x = 40) =>
  both(`<path d="M${x} ${y}H${x - 17}M${x} ${y + 5}L${x - 15} ${y + 10}" ${ln(2)} opacity=".7"/>`);
const lashes = (x, y) => `<path d="M${x - 5} ${y - 5}l-3 -3M${x} ${y - 7}v-3.6M${x + 5} ${y - 5}l3 -3" ${ln(2)}/>`;
const clip = (id, d) => `<clipPath id="mu-av-${id}-clip"><path d="${d}"/></clipPath>`;

const animals = {};
const add = (id, de, en, draw) => (animals[id] = { id, name: { 'de-CH': de, 'en-US': en }, draw });

add('marmot', 'Murmeli', 'Marmot', () => {
  const H = shape(60, 62, 38, 36, 40);
  return `${both(`<circle cx="26" cy="40" r="8.5" fill="${C.fur}" ${O}/><circle cx="26.6" cy="40.6" r="4" fill="${C.furDark}"/>`)}
<path d="${H}" fill="${C.fur}"/>
<path d="M23 58C25 38 40 27 60 27C80 27 95 38 97 58C88 48 74 46 60 52C46 46 32 48 23 58Z" fill="${C.crown}"/>
<path d="${H}" fill="none" ${O}/>
<ellipse cx="60" cy="83" rx="19" ry="14" fill="${C.cream}"/>
${cheeks(78, 32, 88)}
${eye(46, 62)}${happyEye(74, 62)}
<path d="M54.5 73.5Q60 71 65.5 73.5Q64 78.5 60 79Q56 78.5 54.5 73.5Z" fill="${C.ink}"/>
${grin(60, 83, 13, 7.5)}${buckTeeth(60, 83.4, 8, 6)}`;
});

add('ibex', 'Steinbock', 'Ibex', () => {
  const horn = 'M45 36C39 18 28 8 13 11';
  const hornSet = `<path d="${horn}" ${ln(16)}/><path d="${horn}" ${ln(10, '#DCCBAA')}/><path d="${horn}" fill="none" stroke="${C.ink}" stroke-width="10" stroke-dasharray="1.6 5" opacity=".5"/>`;
  return `${both(hornSet)}
${both(`<ellipse cx="22" cy="54" rx="11" ry="5.5" transform="rotate(-25 22 54)" fill="#A9865F" ${O}/><ellipse cx="23" cy="54" rx="6" ry="2.4" transform="rotate(-25 23 54)" fill="#7C5E40"/>`)}
<path d="M51 100Q60 120 69 100Z" fill="#7C5E40" ${O}/>
${head(shape(60, 64, 31, 36, 40), '#A9865F')}
<ellipse cx="60" cy="88" rx="17" ry="13" fill="#E6D6B8"/>
${happyEye(46, 62)}${happyEye(74, 62)}
<path d="M38 52L52 50M68 50L82 52" ${ln(3)}/>
<ellipse cx="55" cy="85" rx="2.2" ry="1.6" fill="${C.ink}"/><ellipse cx="65" cy="85" rx="2.2" ry="1.6" fill="${C.ink}"/>
<path d="M52 93Q61 99 69 91" ${ln(2.8)}/>
${cheeks(76, 36, 84)}`;
});

add('chamois', 'Gämse', 'Chamois', () => {
  const H = shape(60, 64, 30, 34, 40);
  return `${both(`<path d="M48 34C46 18 45 9 37 10" ${ln(6.5)}/>`)}
${both(`<path d="M32 46Q10 42 11 30Q28 31 37 42Z" fill="#C08A55" ${O}/><path d="M30 43Q17 40 16 34Q26 35 32 41Z" fill="#E9B98C"/>`)}
<defs>${clip('chamois', H)}</defs>
<path d="${H}" fill="#C08A55"/>
<g clip-path="url(#mu-av-chamois-clip)">
  <path d="M50 28Q60 24 70 28C75 50 73 74 64 104H56C47 74 45 50 50 28Z" fill="#FBF1DE"/>
  ${both(`<path d="M43 30C37 50 38 70 49 92Q53 94 56 90C50 70 50 48 53 30Z" fill="#4A3528"/>`)}
</g>
<path d="${H}" fill="none" ${O}/>
${ringEye(47, 61, 7.5, 4.4)}${ringEye(73, 61, 7.5, 4.4)}
<path d="M38 44Q46 38 54 44M66 44Q74 38 82 44" ${ln(3)}/>
<ellipse cx="60" cy="84" rx="5.5" ry="3.6" fill="${C.ink}"/>
<ellipse cx="60" cy="94" rx="4.4" ry="5.4" fill="${C.mouth}" ${o(2.4)}/>
${cheeks(80, 36, 84, 6, 3.6, PINK, 0.7)}`;
});

add('cow', 'Kuh', 'Cow', () => {
  const H = shape(60, 60, 34, 32, 40);
  return `${both(`<path d="M31 36Q24 22 32 13Q36 24 41 31Z" fill="#F1E2C0" ${O}/>`)}
${both(`<ellipse cx="17" cy="52" rx="12" ry="6.5" transform="rotate(-15 17 52)" fill="#fff" ${O}/><ellipse cx="18" cy="52" rx="6.5" ry="3" transform="rotate(-15 18 52)" fill="#F7B6C2"/>`)}
<defs>${clip('cow', H)}</defs>
<path d="${H}" fill="#fff"/>
<g clip-path="url(#mu-av-cow-clip)" fill="${C.ink}">
  <path d="M68 40C84 30 100 44 96 60C92 72 78 72 71 63C65 55 61 45 68 40Z"/>
  <path d="M24 42C30 28 46 25 50 34C53 43 40 50 30 52C25 53 22 48 24 42Z"/>
</g>
<path d="${H}" fill="none" ${O}/>
${ringEye(46, 58, 6.5, 4.2)}${ringEye(74, 58, 6.5, 4.2)}${lashes(46, 58)}
<path d="M30 98Q60 113 90 98" ${ln(10)}/><path d="M30 98Q60 113 90 98" ${ln(5, '#D9342B')}/>
<ellipse cx="60" cy="84" rx="26" ry="16" fill="#F7B6C2" ${O}/>
<ellipse cx="49" cy="82" rx="3.2" ry="4.5" fill="#C2607A"/><ellipse cx="71" cy="82" rx="3.2" ry="4.5" fill="#C2607A"/>
<path d="M66 95C77 96 80 86 74.5 82.5C70.5 80 66.5 86 65 94Z" fill="${TONGUE}" ${o(2.2)}/>
<path d="M49 94Q58 99 67 94" ${ln(2.6)}/>
<path d="M52 117Q52 104 60 104Q68 104 68 117Z" fill="${C.sun}" ${o(2.5)}/><circle cx="60" cy="117" r="2.4" fill="${C.ink}"/>`;
});

add('stbernard', 'Bernhardiner', 'St. Bernard', () => {
  const H = shape(60, 62, 34, 34, 40);
  return `${both(`<path d="M30 40C13 40 8 62 12 80C14 91 27 89 31 76Z" fill="#B4532A" ${O}/>`)}
<defs>${clip('stbernard', H)}</defs>
<path d="${H}" fill="#fff"/>
<g clip-path="url(#mu-av-stbernard-clip)" fill="#B4532A">
  <ellipse cx="41" cy="50" rx="16" ry="21"/><ellipse cx="79" cy="50" rx="16" ry="21"/>
</g>
<path d="${H}" fill="none" ${O}/>
${eyes(58, 45, 75, 5, 6)}
<path d="M38 50Q45 46 51 49M69 49Q75 46 82 50" ${ln(2.6)}/>
${tongueDown(61, 90, 6.5, 19)}
<ellipse cx="51" cy="87" rx="11" ry="8.5" fill="#fff" ${o(2.6)}/><ellipse cx="70" cy="87" rx="11" ry="8.5" fill="#fff" ${o(2.6)}/>
<ellipse cx="60.5" cy="75" rx="8.5" ry="6" fill="${C.ink}"/><ellipse cx="58" cy="73" rx="2.8" ry="1.5" fill="#fff" opacity=".6"/>
${cheeks(80, 34, 87)}`;
});

add('fox', 'Fuchs', 'Fox', () => {
  const H = 'M60 28C78 28 92 40 96 56L106 74C96 86 80 98 60 99C40 98 24 86 14 74L24 56C28 40 42 28 60 28Z';
  return `${both(`<path d="M30 48L22 10L52 32Z" fill="#EF7D32" ${O}/><path d="M31 40L26.5 21L43 33Z" fill="#FDE7CF"/><path d="M24.2 19.4L22 10L29.6 15.6Z" fill="${C.ink}" ${o(2)}/>`)}
<path d="${H}" fill="#EF7D32"/>
<path d="M14 74C30 69 46 73 60 86C74 73 90 69 106 74C96 86 80 98 60 99C40 98 24 86 14 74Z" fill="#fff"/>
<path d="${H}" fill="none" ${O}/>
${eye(46, 60)}${happyEye(74, 60)}
<path d="M37 49L53 52M67 50Q75 45 83 49" ${ln(3)}/>
<ellipse cx="60" cy="85.5" rx="5.5" ry="4" fill="${C.ink}"/>
<path d="M53 91Q60 96 68 89" ${ln(2.6)}/>
${cheeks(79, 31, 89)}`;
});

add('hedgehog', 'Igel', 'Hedgehog', () => {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const a = ((-200 + i * 11) * Math.PI) / 180;
    const r = i % 2 ? 36 : 50;
    pts.push(`${round(60 + r * Math.cos(a))} ${round(66 + r * Math.sin(a))}`);
  }
  return `<path d="M${pts.join('L')}Z" fill="#7A5338" ${O}/>
<path d="M${pts.slice(2, 19).join('L')}" fill="none" stroke="#A47A56" stroke-width="2.4" stroke-linejoin="round" transform="translate(60 66) scale(.78) translate(-60 -66)"/>
<circle cx="84" cy="23" r="7.5" fill="#E5484D" ${o(2.5)}/><path d="M84 16V11" ${ln(2.4)}/><path d="M85 13Q90 8 94 11Q90 16 85 13Z" fill="${C.meadowTop}" ${o(1.8)}/>
${both(`<circle cx="31" cy="49" r="6.5" fill="#F2D7B0" ${O}/>`)}
${head(shape(60, 70, 32, 28, 30), '#F2D7B0')}
${eyes(66, 47, 73, 4.6, 5.6)}
<circle cx="60" cy="78" r="5.2" fill="${C.ink}"/><circle cx="58.4" cy="76.4" r="1.6" fill="#fff"/>
${smile(60, 86, 7, 4)}
${cheeks(80, 38, 82)}`;
});

add('owl', 'Eule', 'Owl', () => `
<path d="M24 40L19 13L44 28Q60 24 76 28L101 13L96 40C104 56 104 80 96 94C86 108 34 108 24 94C16 80 16 56 24 40Z" fill="#9C7A5B" ${O}/>
<circle cx="44" cy="58" r="18" fill="none" ${o(2.5)}/><circle cx="76" cy="58" r="18" fill="none" ${o(2.5)}/>
<circle cx="44" cy="58" r="18" fill="#EEDFC8"/><circle cx="76" cy="58" r="18" fill="#EEDFC8"/>
<circle cx="44" cy="58" r="12" fill="#F7B32B" ${o(2.5)}/><circle cx="44" cy="59" r="7.5" fill="${C.ink}"/><circle cx="41.5" cy="56" r="2.8" fill="#fff"/>
<circle cx="76" cy="58" r="12" fill="#F7B32B" ${o(2.5)}/><circle cx="76" cy="59" r="3.8" fill="${C.ink}"/><circle cx="75" cy="57.6" r="1.3" fill="#fff"/>
<path d="M30 37Q44 28 57 37M63 41L89 36" ${ln(3.4)}/>
<path d="M53 71Q60 67 67 71L60 84Z" fill="#F29F05" ${o(2.5)}/>
<path d="M46 92l4 4 4-4M56 98l4 4 4-4M66 92l4 4 4-4" ${ln(2.4, '#6E5440')}/>
${cheeks(78, 28, 92)}`);

add('squirrel', 'Eichhörnchen', 'Squirrel', () => `
${both(`<path d="M31 42L25 14L48 32Z" fill="#D9732E" ${O}/><path d="M25 14L20 7M26 13L26 5M28 14L32 7" ${ln(2.6)}/><path d="M32 37L28.5 21L42 32Z" fill="#F6D7B0"/>`)}
${head(shape(60, 62, 32, 34, 38), '#D9732E')}
<ellipse cx="34" cy="80" rx="17" ry="14" fill="#F6D7B0" ${O}/><ellipse cx="86" cy="80" rx="17" ry="14" fill="#F6D7B0" ${O}/>
${cheeks(80, 31, 89, 6, 3.6, PINK, 0.6)}
${eyes(56, 46, 74, 5.5, 6.8)}
<path d="M56 74Q60 72 64 74L60 78.5Z" fill="#6B3A22" ${o(1.8)}/>
${wMouth(60, 81, 6)}${buckTeeth(60, 83, 9, 7.5)}`);

add('rabbit', 'Hase', 'Rabbit', () => `
<ellipse cx="44" cy="23" rx="9.5" ry="21" transform="rotate(-12 44 23)" fill="#EEE9F2" ${O}/><ellipse cx="44" cy="24" rx="4.5" ry="14" transform="rotate(-12 44 24)" fill="#F7B6C8"/>
<path d="M70 44C68 26 72 10 84 8C93 7 97 15 90 19C84 23 80 32 80 44Z" fill="#EEE9F2" ${O}/><path d="M74 40C73 28 76 17 83 14C87 13 89 16 86 19C81 23 78 31 78 40Z" fill="#F7B6C8"/>
${head(shape(60, 68, 34, 32, 34), '#EEE9F2')}
${eyes(64, 46, 74, 5.5, 7)}
${cheeks(80, 34, 86)}
<path d="M56 76Q60 74 64 76Q62 80 60 80Q58 80 56 76Z" fill="#F48FB1" ${o(1.8)}/>
${wMouth(60, 82, 7)}${buckTeeth(60, 84.5, 8, 6.5)}
${whiskers(79, 40)}`);

add('bear', 'Bär', 'Bear', () => `
${both(`<circle cx="30" cy="36" r="11" fill="#8B5A3C" ${O}/><circle cx="30.8" cy="36.8" r="5.5" fill="#D7A77B"/>`)}
${head(shape(60, 64, 36, 34, 38), '#8B5A3C')}
<path d="M46 32Q60 26 74 32L74 36Q72.5 43 70 37Q67 32 64.5 40Q62 47 59 38Q56 32 53 37Q50 42 47.5 36Z" fill="#F5B70A" ${o(2.2)}/>
<ellipse cx="60" cy="82" rx="17" ry="13" fill="#E8C9A0"/>
${happyEye(46, 60)}${happyEye(74, 60)}
<path d="M53 74Q60 70 67 74Q65 80 60 80.5Q55 80 53 74Z" fill="${C.ink}"/>
<ellipse cx="71" cy="89" rx="4" ry="5.5" transform="rotate(-35 71 89)" fill="${TONGUE}" ${o(2.2)}/>
${wMouth(60, 83, 9)}
${cheeks(76, 32, 88)}`);

add('frog', 'Frosch', 'Frog', () => `
${head(shape(60, 74, 46, 30, 30), '#6CC24A')}
${both(`<circle cx="40" cy="45" r="15" fill="#6CC24A" ${O}/><circle cx="40" cy="45" r="10" fill="#fff" ${o(2.4)}/>`)}
<circle cx="44.5" cy="47" r="5" fill="${C.ink}"/><circle cx="43" cy="45.4" r="1.7" fill="#fff"/>
<circle cx="75.5" cy="47" r="5" fill="${C.ink}"/><circle cx="74" cy="45.4" r="1.7" fill="#fff"/>
<circle cx="55" cy="66" r="1.8" fill="${C.ink}"/><circle cx="65" cy="66" r="1.8" fill="${C.ink}"/>
${tongueDown(61, 88, 6.5, 15)}
<path d="M26 78Q60 102 94 78" ${ln(3.4)}/>
${cheeks(84, 26, 94, 6.5, 4)}`);

add('penguin', 'Pinguin', 'Penguin', () => `
<path d="M57 28Q56 17 64 12M62 28Q66 20 74 20" ${ln(4.5, '#2C3446')}/>
${head(shape(60, 62, 38, 36, 40), '#2C3446')}
<path d="M60 98C40 98 26 84 28 66C30 52 42 46 52 52Q60 57 68 52C78 46 90 52 92 66C94 84 80 98 60 98Z" fill="#fff"/>
${happyEye(46, 67)}${happyEye(74, 67)}
<path d="M51 77Q60 70 69 77Q60 88 51 77Z" fill="#F59E0B" ${o(2.5)}/>
${cheeks(82, 37, 83, 6.5, 4, PINK, 0.7)}`);

add('cat', 'Katze', 'Cat', () => `
${both(`<path d="M28 46L25 14L52 32Z" fill="#F2A65A" ${O}/><path d="M31 39L29.5 22L44 32Z" fill="#F7B6C2"/>`)}
${head(shape(60, 64, 38, 34, 36), '#F2A65A')}
<path d="M52 33L54 41M60 31V41M68 33L66 41M23 60H30M23 68H29M97 60H90M97 68H91" ${ln(3.4, '#D9813A')}/>
<ellipse cx="54" cy="81" rx="8" ry="6" fill="#FFF1E0"/><ellipse cx="66" cy="81" rx="8" ry="6" fill="#FFF1E0"/>
${eyes(62, 45, 75, 6, 7.2)}
${tongueDown(60, 82, 3.6, 8)}
<path d="M56 74H64L60 79Z" fill="#F48FB1" ${o(1.8)}/>
${wMouth(60, 81, 7)}
${whiskers(80, 40)}
${cheeks(77, 32, 88)}`);

add('mouse', 'Maus', 'Mouse', () => `
${both(`<circle cx="26" cy="38" r="17" fill="#A7AEBB" ${O}/><circle cx="27" cy="39" r="10.5" fill="#F7B6C8"/>`)}
${head(shape(60, 68, 32, 32, 34), '#A7AEBB')}
<ellipse cx="60" cy="85" rx="14" ry="10" fill="#D5D9E0"/>
${eyes(64, 47, 73, 5.5, 7)}
<circle cx="60" cy="80" r="4.5" fill="#F48FB1" ${o(2)}/>
${wMouth(60, 87, 6)}${buckTeeth(60, 88.5, 6.5, 5)}
${whiskers(83, 42)}
${cheeks(80, 36, 84)}`);

add('badger', 'Dachs', 'Badger', () => {
  const H = shape(60, 64, 36, 34, 40);
  return `${both(`<circle cx="30" cy="36" r="8.5" fill="#8E959E" ${O}/><circle cx="30.6" cy="36.6" r="4" fill="#F4F4F4"/>`)}
<defs>${clip('badger', H)}</defs>
<path d="${H}" fill="#F7F5F0"/>
<g clip-path="url(#mu-av-badger-clip)">
  <path d="M16 60C20 80 34 98 60 104H18Z" fill="#8E959E"/><path d="M104 60C100 80 86 98 60 104H102Z" fill="#8E959E"/>
  ${both(`<path d="M38 28C32 46 36 70 52 90L58 87C49 68 47 46 51 28Z" fill="#2E2A2A"/>`)}
</g>
<path d="${H}" fill="none" ${O}/>
${ringEye(46, 60, 6.5, 4)}${ringEye(74, 60, 6.5, 4)}
<ellipse cx="60" cy="86" rx="7.5" ry="5" fill="${C.ink}"/><ellipse cx="58" cy="84.5" rx="2.4" ry="1.2" fill="#fff" opacity=".6"/>
${grin(60, 93, 10, 5)}<path d="M53 93.6H67V95.5Q60 97 53 95.5Z" fill="#fff"/>
${cheeks(80, 30, 90)}`;
});

add('eagle', 'Adler', 'Eagle', () => {
  const H = 'M60 24C80 24 96 38 98 58L105 64L97 68L102 76L94 78C88 96 74 104 60 104C46 104 32 96 26 78L18 76L23 68L15 64L22 58C24 38 40 24 60 24Z';
  return `<path d="M58 26Q53 12 62 7Q60 16 67 13Q65 20 63 26Z" fill="#D9A441" ${o(2.5)}/>
<defs>${clip('eagle', H)}</defs>
<path d="${H}" fill="#8C5A2B"/>
<path clip-path="url(#mu-av-eagle-clip)" d="M18 52C24 36 42 24 60 24C78 24 96 36 102 52C88 44 74 42 60 46C46 42 32 44 18 52Z" fill="#D9A441"/>
<path d="${H}" fill="none" ${O}/>
${eyes(60, 46, 74, 5, 6)}
<path d="M34 49L54 54M66 47Q76 38 87 45" ${ln(4)}/>
<path d="M48 68Q60 60 72 68Q74 82 62 93Q64 84 60 80Q52 76 48 68Z" fill="#F5B700" ${o(2.6)}/>
<circle cx="64.5" cy="69.5" r="1.5" fill="${C.ink}"/>
${cheeks(76, 32, 88)}`;
});

add('goat', 'Geiss', 'Goat', () => {
  const horn = 'M45 35C42 22 33 17 26 19';
  const goatEye = (x) =>
    `<ellipse cx="${x}" cy="60" rx="7" ry="5.8" fill="#E9C46A" ${o(2.2)}/><rect x="${x - 4.5}" y="58.6" width="9" height="2.8" rx="1.4" fill="${C.ink}"/><circle cx="${x - 3}" cy="57.6" r="1.3" fill="#fff"/>`;
  return `${both(`<path d="${horn}" ${ln(11)}/><path d="${horn}" ${ln(5.5, '#B8B1A6')}/>`)}
${both(`<ellipse cx="17" cy="57" rx="13" ry="6" transform="rotate(20 17 57)" fill="#F3EBDD" ${O}/><ellipse cx="18" cy="57" rx="7" ry="2.6" transform="rotate(20 18 57)" fill="#E8B8B0"/>`)}
<path d="M53 100Q56 117 60 112Q64 117 67 100Z" fill="#E2D8C6" ${O}/>
${head(shape(60, 64, 30, 34, 40), '#F3EBDD')}
<ellipse cx="60" cy="90" rx="16" ry="12" fill="#EADFCF"/>
${goatEye(45)}${goatEye(75)}
<ellipse cx="55" cy="86" rx="2" ry="2.6" fill="#B58D86"/><ellipse cx="65" cy="86" rx="2" ry="2.6" fill="#B58D86"/>
<path d="M65 96L91 83M65 96L88 94" ${ln(6.5)}/><path d="M65 96L91 83M65 96L88 94" ${ln(3, C.meadowTop)}/>
<path d="M53 95Q60 99 66 95.5" ${ln(2.6)}/>
${cheeks(78, 36, 84)}`;
});

add('sheep', 'Schaf', 'Sheep', () => {
  const wool = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `<circle cx="${round(60 + 38 * Math.cos(a))}" cy="${round(60 + 38 * Math.sin(a))}" r="14" fill="#FBF4E6" ${O}/>`;
  }).join('');
  return `${wool}
<circle cx="60" cy="60" r="38" fill="#FBF4E6"/>
${both(`<ellipse cx="31" cy="66" rx="11" ry="5.5" transform="rotate(25 31 66)" fill="#F5D9C8" ${O}/>`)}
${head(shape(60, 72, 24, 26, 28), '#F5D9C8')}
<circle cx="49" cy="47" r="9" fill="#FBF4E6" ${O}/><circle cx="71" cy="47" r="9" fill="#FBF4E6" ${O}/><circle cx="60" cy="43" r="10" fill="#FBF4E6" ${O}/>
${sleepyEye(50, 69, 5)}${sleepyEye(70, 69, 5)}
<path d="M56 80Q60 78 64 80Q62 83.5 60 83.5Q58 83.5 56 80Z" fill="#B5766B"/>
${smile(60, 88, 5.5, 3.5)}
${cheeks(81, 43, 77, 5, 3.2, PINK, 0.7)}`;
});

add('pig', 'Säuli', 'Pig', () => `
${both(`<path d="M30 30L48 36L34 53Z" fill="#F7A8B8" ${O}/><path d="M33 36L42 39L35 47Z" fill="#E98AA0"/>`)}
${head(shape(60, 64, 38, 34, 36), '#F7A8B8')}
<path d="M40 54L48 59L40 64M80 54L72 59L80 64" ${ln(3.4)}/>
${cheeks(72, 33, 87, 6.5, 4, '#F06C8C', 0.55)}
<ellipse cx="60" cy="77" rx="14" ry="10" fill="#F48FA6" ${O}/>
<ellipse cx="55" cy="77" rx="2.6" ry="4" fill="#B3566E"/><ellipse cx="65" cy="77" rx="2.6" ry="4" fill="#B3566E"/>
${grin(60, 91, 9, 4.5)}<path d="M55.6 95.4Q60 92 64.4 95.4Q60 97.6 55.6 95.4Z" fill="${TONGUE}"/>`);

add('lion', 'Löwe', 'Lion', () => {
  const mane = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return `<circle cx="${round(60 + 39 * Math.cos(a))}" cy="${round(62 + 39 * Math.sin(a))}" r="15" fill="#E8892B" ${O}/>`;
  }).join('');
  return `${mane}<circle cx="60" cy="62" r="39" fill="#E8892B"/>
${both(`<circle cx="37" cy="37" r="8" fill="#F6C453" ${O}/><circle cx="37.5" cy="37.5" r="4" fill="#E8A84B"/>`)}
${head(shape(60, 64, 32, 30, 34), '#F6C453')}
<ellipse cx="53" cy="79" rx="9" ry="7" fill="#FFF0CC"/><ellipse cx="67" cy="79" rx="9" ry="7" fill="#FFF0CC"/>
${happyEye(46, 59)}${happyEye(74, 59)}
${grin(60, 84, 10, 6.5)}<path d="M54.5 92Q60 87 65.5 92Q60 95 54.5 92Z" fill="${TONGUE}"/>
<path d="M54 71Q60 68 66 71Q64 76 60 77Q56 76 54 71Z" fill="#B5654A" ${o(1.8)}/>
${cheeks(74, 36, 84)}`;
});

add('panda', 'Panda', 'Panda', () => `
${both(`<circle cx="30" cy="34" r="11" fill="#2E2E36" ${O}/>`)}
${head(shape(60, 64, 38, 34, 38), '#fff')}
<ellipse cx="45" cy="62" rx="9" ry="12" transform="rotate(35 45 62)" fill="#2E2E36"/><ellipse cx="75" cy="62" rx="9" ry="12" transform="rotate(-35 75 62)" fill="#2E2E36"/>
<circle cx="46" cy="61" r="4.8" fill="#fff"/><circle cx="47.8" cy="61.6" r="3" fill="${C.ink}"/><circle cx="47.2" cy="60.6" r="1" fill="#fff"/>
<circle cx="74" cy="61" r="4.8" fill="#fff"/><circle cx="75.8" cy="61.6" r="3" fill="${C.ink}"/><circle cx="75.2" cy="60.6" r="1" fill="#fff"/>
<path d="M55 76Q60 73 65 76Q63 80 60 80.5Q57 80 55 76Z" fill="${C.ink}"/>
${wMouth(60, 82.5, 5)}
${cheeks(81, 33, 87, 7, 4.2, PINK, 0.75)}
<path d="M29 80l2-3M33 80l2-3M37 80l2-3M83 80l2-3M87 80l2-3M91 80l2-3" ${ln(1.6, '#E36A85')}/>`);

add('koala', 'Koala', 'Koala', () => {
  return `${both(`<circle cx="22" cy="44" r="20" fill="#9DA7B3" ${O}/><circle cx="23.5" cy="46" r="12" fill="#E8EBEF"/>`)}
${head(shape(60, 66, 34, 32, 36), '#9DA7B3')}
${eyes(61, 45, 75, 5, 6)}
<path d="M38 52Q45 49 51 52M69 52Q75 49 82 52" ${ln(2.6)}/>
<ellipse cx="60" cy="75" rx="9" ry="12.5" fill="#3F3A45" ${o(2)}/><ellipse cx="57" cy="70" rx="2.4" ry="3.6" fill="#fff" opacity=".5"/>
${smile(60, 91, 6, 3.5)}
${cheeks(81, 38, 82)}`;
});

add('monkey', 'Äffli', 'Monkey', () => `
${both(`<circle cx="17" cy="62" r="12" fill="#8B5E3C" ${O}/><circle cx="18" cy="62.5" r="7" fill="#F2C9A0"/>`)}
<path d="M55 27Q55 17 62 13M60 27Q64 19 72 19" ${ln(8)}/><path d="M55 27Q55 17 62 13M60 27Q64 19 72 19" ${ln(3.5, '#8B5E3C')}/>
${head(shape(60, 62, 38, 36, 38), '#8B5E3C')}
<g ${o(2.5)}><circle cx="47" cy="58" r="14" fill="none"/><circle cx="73" cy="58" r="14" fill="none"/><ellipse cx="60" cy="81" rx="23" ry="16" fill="none"/></g>
<g fill="#F2C9A0"><circle cx="47" cy="58" r="14"/><circle cx="73" cy="58" r="14"/><ellipse cx="60" cy="81" rx="23" ry="16"/></g>
${eyes(58, 47, 73, 5, 6.2)}
<circle cx="57" cy="73" r="1.6" fill="${C.ink}"/><circle cx="63" cy="73" r="1.6" fill="${C.ink}"/>
<path d="M44 80Q60 100 76 80Q60 84 44 80Z" fill="#fff" ${o(2.5)}/>
<path d="M52 82.4V89.6M60 83V92M68 82.4V89.6M47 85.4Q60 89 73 85.4" ${ln(1.5)}/>
${cheeks(77, 30, 90)}`);

add('elephant', 'Elefant', 'Elephant', () => {
  const trunk = 'M60 72C60 94 71 104 84 98C92 94 92 86 86 84';
  const drop = (x, y, s = 1) => `<path d="M${x} ${y - 6 * s}Q${x + 4.5 * s} ${y} ${x} ${y + 2 * s}Q${x - 4.5 * s} ${y} ${x} ${y - 6 * s}Z" fill="${C.sky}" ${o(1.8)}/>`;
  return `${both(`<path d="M32 40C12 28 2 52 6 70C10 88 27 92 35 80Z" fill="#9AB0C6" ${O}/><path d="M29 48C17 43 12 58 14 68C16 80 26 82 31 74Z" fill="#F4B6C2"/>`)}
${head(shape(60, 60, 30, 32, 36), '#9AB0C6')}
${happyEye(46, 57)}${happyEye(74, 57)}
${cheeks(70, 38, 82)}
<path d="M41 83Q46 88 51 84" ${ln(2.6)}/>
<path d="${trunk}" ${ln(18)}/><path d="${trunk}" ${ln(11.5, '#9AB0C6')}/>
<path d="M54 84Q60 87 66 84M57 92Q63 94 69 90" ${ln(1.8)} opacity=".55"/>
${drop(91, 72)}${drop(99, 63, 0.8)}${drop(86, 62, 0.7)}`;
});

add('giraffe', 'Giraffe', 'Giraffe', () => {
  const H = shape(60, 62, 28, 34, 42, 0.6);
  return `${both(`<path d="M48 31L46 15" ${ln(7.5)}/><path d="M48 31L46 15" ${ln(3, '#E0A33D')}/><circle cx="46" cy="12" r="5.5" fill="#9A5A2A" ${O}/>`)}
${both(`<path d="M33 43Q12 36 10 45Q20 53 34 50Z" fill="#F5C451" ${O}/>`)}
<defs>${clip('giraffe', H)}</defs>
<path d="${H}" fill="#F5C451"/>
<g clip-path="url(#mu-av-giraffe-clip)" fill="#C97B3A">
  <path d="M36 34Q44 30 46 38Q44 45 37 43Q31 40 36 34Z"/><path d="M74 38Q83 36 86 44Q84 51 77 49Q71 45 74 38Z"/>
  <path d="M30 62Q36 58 39 65Q36 71 31 69Z"/><path d="M84 66Q91 63 92 71Q88 76 84 72Z"/><path d="M57 30Q63 28 65 34Q61 37 57 34Z"/>
</g>
<path d="${H}" fill="none" ${O}/>
<ellipse cx="60" cy="89" rx="20" ry="14" fill="#F9DFA0" ${o(2.5)}/>
${eyes(60, 47, 73, 5, 6.2)}${lashes(47, 60)}${lashes(73, 60)}
<ellipse cx="53" cy="85" rx="2" ry="2.8" fill="${C.ink}"/><ellipse cx="67" cy="85" rx="2" ry="2.8" fill="${C.ink}"/>
<path d="M63 96C70 103 81 103 83 95C84 90 79 89 78 93C77 97 70 98 65 94Z" fill="#7E6BC4" ${o(2.2)}/>
<path d="M51 95Q57 99 64 95.5" ${ln(2.6)}/>
${cheeks(76, 38, 82, 5.5, 3.4)}`;
});

add('unicorn', 'Einhorn', 'Unicorn', () => `
<path d="M42 37L32 13L27 41Z" fill="#fff" ${O}/>
${head(shape(60, 64, 32, 34, 40), '#fff')}
<path d="M78 37L88 13L93 41Z" fill="#fff" ${O}/><path d="M81 35L87 20L89.5 37Z" fill="#F7B6C8"/>
${limb('M27 84C22 94 28 103 40 104', '#7CC4F2', 10, 3)}
${limb('M25 64C16 74 17 86 27 92', '#7EE0B0', 10, 3)}
${limb('M31 42C20 50 18 62 25 72', '#FFD54F', 10, 3)}
${limb('M52 29C38 24 27 33 27 48', '#FF8FB1', 10, 3)}
${limb('M47 30C51 38 57 40 64 37', '#B69CF0', 9, 3)}
<path d="M54 31L60 3L66 31Z" fill="${C.sun}" ${o(2.5)}/>
<path d="M55.6 25L64.4 21M57.1 17.6L62.9 14.8M58.6 10.4L61.4 9" ${ln(1.8)}/>
<ellipse cx="60" cy="88" rx="18" ry="12" fill="#F6E6FF"/>
${happyEye(46, 63)}${happyEye(74, 63)}
<path d="M40 60l-3.6-2.4M80 60l3.6-2.4" ${ln(2.4)}/>
<ellipse cx="54.5" cy="86" rx="1.8" ry="2.4" fill="${C.ink}"/><ellipse cx="65.5" cy="86" rx="1.8" ry="2.4" fill="${C.ink}"/>
${smile(60, 94, 7, 4)}
${cheeks(77, 37, 84, 6, 3.6, PINK, 0.7)}
${sparkle(99, 26, 6.5)}${sparkle(106, 44, 3, '#fff')}`);

add('dragon', 'Drache', 'Dragon', () => {
  return `${both(`<path d="M41 34Q32 20 38 9Q44 22 49 30Z" fill="#F3E3B5" ${O}/>`)}
${both(`<path d="M26 50L7 40L15 56L4 66L24 69Z" fill="#2E9A7E" ${O}/>`)}
${head(shape(60, 64, 36, 34, 38), '#4FB59A')}
<path d="M60 31L64 37L60 43L56 37Z" fill="#2E9A7E" ${o(2)}/><g fill="#3FA587"><circle cx="40" cy="40" r="3"/><circle cx="80" cy="40" r="3"/><circle cx="33" cy="50" r="2"/><circle cx="87" cy="50" r="2"/></g>
<ellipse cx="60" cy="85" rx="22" ry="14" fill="#8ED5BE" ${o(2.5)}/>
${eyes(60, 46, 74, 5, 6.2)}
<path d="M38 50Q45 45 52 49M68 49Q75 45 82 50" ${ln(3)}/>
<ellipse cx="52" cy="81" rx="2.6" ry="3.4" fill="${C.ink}"/><ellipse cx="68" cy="81" rx="2.6" ry="3.4" fill="${C.ink}"/>
<path d="M49 92Q60 100 71 92" ${ln(2.8)}/><path d="M63 95.6L65.4 101L67.8 94.4Z" fill="#fff" ${o(1.6)}/>
${cheeks(74, 33, 87)}`;
});

add('trex', 'Dino', 'T-Rex', () => {
  const q = (t, c) => {
    const x = (1 - t) ** 2 * 28 + 2 * (1 - t) * t * 60 + t * t * 92;
    const y = (1 - t) ** 2 * 76 + 2 * (1 - t) * t * c + t * t * 76;
    return [round(x), round(y)];
  };
  const teeth = (c, dir) =>
    [0.16, 0.3, 0.44, 0.58, 0.72, 0.86]
      .map((t) => {
        const [x, y] = q(t, c);
        return `<path d="M${x - 2.8} ${y}L${x} ${round(y + dir * 5.5)}L${x + 2.8} ${y}Z" fill="#fff" ${o(1.4)}/>`;
      })
      .join('');
  return `${head('M18 58C18 36 38 24 60 24C84 24 102 36 102 58C102 84 86 104 60 104C34 104 18 84 18 58Z', '#8BC34A')}
<g fill="#6FA83A"><circle cx="40" cy="36" r="4"/><circle cx="52" cy="30" r="2.8"/><circle cx="78" cy="34" r="5"/><circle cx="89" cy="46" r="3"/></g>
${eyes(52, 44, 76, 4.6, 5.6)}
<path d="M36 42L50 44M70 44L84 42" ${ln(3.2)}/>
<ellipse cx="54" cy="64" rx="2" ry="2.6" fill="${C.ink}"/><ellipse cx="66" cy="64" rx="2" ry="2.6" fill="${C.ink}"/>
<path d="M28 76Q60 112 92 76Q60 82 28 76Z" fill="${C.mouth}" ${o(2.8)}/>
${teeth(82, 1)}${teeth(112, -1)}
${cheeks(72, 28, 92)}`;
});

add('octopus', 'Krake', 'Octopus', () => {
  const tents = [
    'M30 78C24 94 14 98 11 90',
    'M43 82C43 100 36 110 29 107',
    'M55 84C55 104 53 112 47 114',
    'M65 84C65 104 67 112 73 114',
    'M77 82C77 100 84 110 91 107',
    'M92 72C108 64 112 46 104 39C100 36 96 40 99 44',
  ];
  const t = tents.map((d) => limb(d, '#B58BE8', 9, 3)).join('');
  return `${t}
<g fill="#E3D0FA"><circle cx="12" cy="90" r="1.8"/><circle cx="30" cy="106" r="1.8"/><circle cx="48" cy="113" r="1.8"/><circle cx="72" cy="113" r="1.8"/><circle cx="90" cy="106" r="1.8"/><circle cx="103" cy="40" r="1.8"/></g>
${head('M60 16C88 16 100 36 100 58C100 74 88 86 60 86C32 86 20 74 20 58C20 36 32 16 60 16Z', '#B58BE8')}
<g fill="#D3B8F5"><circle cx="40" cy="32" r="4.5"/><circle cx="78" cy="27" r="3.6"/><circle cx="87" cy="41" r="2.6"/></g>
${eyes(55, 46, 74, 5.5, 6.8)}
${tongueDown(61, 71, 5, 11)}
<path d="M49 67Q60 79 71 67" ${ln(2.8)}/>
${cheeks(68, 33, 87)}`;
});

export const animalList = Object.values(animals);
export const avatarSvg = (a) => svg('0 0 120 120', a.draw(), { cls: `mu-avatar mu-avatar--${a.id}`, label: a.name['en-US'] });
