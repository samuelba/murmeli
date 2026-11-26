import type { Locale } from './locale.ts';

export type Currency = 'CHF' | 'USD';
export type MoneyGroup = 'major' | 'minor';

export interface Denomination {
  readonly id: string;
  readonly currency: Currency;
  readonly value: number;
  readonly kind: 'coin' | 'note';
  readonly group: MoneyGroup;
  readonly label: string;
  readonly file: string;
}

const coin = (
  id: string,
  currency: Currency,
  value: number,
  label: string,
  kind: 'coin' | 'note' = 'coin',
): Denomination => ({
  id,
  currency,
  value,
  kind,
  group: value >= 100 ? 'major' : 'minor',
  label,
  file: `money/${id}.svg`,
});

export const DENOMINATIONS: readonly Denomination[] = [
  coin('chf-5rp', 'CHF', 5, '5 Rp'),
  coin('chf-10rp', 'CHF', 10, '10 Rp'),
  coin('chf-20rp', 'CHF', 20, '20 Rp'),
  coin('chf-50rp', 'CHF', 50, '50 Rp'),
  coin('chf-1fr', 'CHF', 100, '1 Fr.'),
  coin('chf-2fr', 'CHF', 200, '2 Fr.'),
  coin('chf-5fr', 'CHF', 500, '5 Fr.'),
  coin('chf-10fr', 'CHF', 1000, '10 Fr.', 'note'),
  coin('chf-20fr', 'CHF', 2000, '20 Fr.', 'note'),
  coin('usd-1c', 'USD', 1, '1¢'),
  coin('usd-5c', 'USD', 5, '5¢'),
  coin('usd-10c', 'USD', 10, '10¢'),
  coin('usd-25c', 'USD', 25, '25¢'),
  coin('usd-1', 'USD', 100, '$1', 'note'),
  coin('usd-5', 'USD', 500, '$5', 'note'),
  coin('usd-10', 'USD', 1000, '$10', 'note'),
  coin('usd-20', 'USD', 2000, '$20', 'note'),
];

export const LOCALE_CURRENCY: Readonly<Record<Locale, Currency>> = {
  'de-CH': 'CHF',
  'en-US': 'USD',
};

export function currencyFor(
  param: Currency | 'auto',
  locale: Locale,
): Currency {
  return param === 'auto' ? LOCALE_CURRENCY[locale] : param;
}

export function denominationsFor(
  currency: Currency,
  group: MoneyGroup,
): Denomination[] {
  return DENOMINATIONS.filter(
    (d) => d.currency === currency && d.group === group,
  );
}

export function moneyUnit(group: MoneyGroup): number {
  return group === 'major' ? 100 : 1;
}
