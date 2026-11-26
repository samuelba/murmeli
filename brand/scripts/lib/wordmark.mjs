import { svg } from './common.mjs';
import { markBody } from './logo.mjs';
import { WORDMARK } from './wordmark-glyphs.mjs';

const TILT = [-4, 3, -2, 3, -3, 4, -3];
const LIFT = [0, -1.5, 0.5, -1, 0.5, -1.5, 0];

export const wordmark = ({ color = '#5A3A22', accent = '#F7C600' } = {}) => {
  const x0 = 124;
  const y0 = 30;
  const letters = WORDMARK.glyphs
    .map((g, i) => `<path d="${g.d}" transform="translate(0 ${LIFT[i]}) rotate(${TILT[i]} ${g.cx} ${g.cy})"/>`)
    .join('\n    ');
  const w = Math.ceil(x0 + WORDMARK.width + 10);
  return svg(
    `0 0 ${w} 112`,
    `<g transform="scale(.875)">${markBody(false)}</g>
<g class="mu-wordmark-text" transform="translate(${x0} ${y0})" fill="${color}">
    ${letters}
</g>
<path d="M${x0 + 4} ${y0 + WORDMARK.height + 12}Q${x0 + WORDMARK.width / 2} ${y0 + WORDMARK.height + 20} ${x0 + WORDMARK.width - 4} ${y0 + WORDMARK.height + 10}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>`,
    { cls: 'mu-wordmark', label: 'Murmeli' },
  );
};
