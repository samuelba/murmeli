import type { Currency, MoneyGroup } from '@murmeli/content';

/** The amount with its unit as kids see it on price tags: 7 Fr., 70 Rp., $7, 70¢. */
export function formatMoney(value: number | string, currency: Currency, group: MoneyGroup): string {
  const { before, after } = unitParts(currency, group);
  return after === 'Fr.' || after === 'Rp.' ? `${value} ${after}` : `${before}${value}${after}`;
}

/** Where the unit goes next to an answer blank. */
export function unitParts(
  currency: Currency,
  group: MoneyGroup,
): { readonly before: string; readonly after: string } {
  if (currency === 'USD') {
    return group === 'major' ? { before: '$', after: '' } : { before: '', after: '¢' };
  }
  return { before: '', after: group === 'major' ? 'Fr.' : 'Rp.' };
}
