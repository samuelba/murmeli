export const ROLES = ['parent', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const LOCALES = ['de-CH', 'en-US'] as const;
export type Locale = (typeof LOCALES)[number];

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export function sqlList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}
