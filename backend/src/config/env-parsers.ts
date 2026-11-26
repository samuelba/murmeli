import { z } from 'zod';
import { errorMessage } from '../common/errors/error-message';

const TRUE_VALUES = new Set(['true', '1', 'yes']);
const FALSE_VALUES = new Set(['false', '0', 'no']);

export function parseBoolean(
  raw: string | undefined,
  fallback: boolean,
): boolean {
  const value = raw?.trim().toLowerCase();
  if (value === undefined || value === '') {
    return fallback;
  }
  if (TRUE_VALUES.has(value)) {
    return true;
  }
  if (FALSE_VALUES.has(value)) {
    return false;
  }
  throw new Error(`"${raw}" is not a boolean (use true or false)`);
}

export function envBoolean(fallback: boolean) {
  return z
    .string()
    .optional()
    .transform((raw, ctx) => {
      try {
        return parseBoolean(raw, fallback);
      } catch (error) {
        ctx.addIssue({ code: 'custom', message: errorMessage(error) });
        return z.NEVER;
      }
    });
}

export function envInt(fallback: number, min: number, max: number) {
  return z.coerce.number().int().min(min).max(max).default(fallback);
}

export function envPort(fallback: number) {
  return envInt(fallback, 1, 65535);
}

export function envRequired() {
  return z.string({ error: 'is required' }).trim().min(1, 'is required');
}

export function envDuration(fallback: string) {
  return z
    .string()
    .regex(/^\d+(ms|s|m|h|d)$/, 'must be a duration like 15m, 12h or 30d')
    .default(fallback);
}

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function parseOriginList(raw: string): string[] {
  return raw
    .split(',')
    .map(normalizeOrigin)
    .filter((origin) => origin !== '');
}

export function isHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return (code < 0x20 && char !== '\n') || code === 0x7f;
  });
}

export function normalizePlainText(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Optional plain text shown to users as is. A literal `\n` is a line break,
 * so multi-line values fit on one env line; other control characters are
 * rejected.
 */
export function envPlainText(max: number) {
  return z
    .string()
    .transform(normalizePlainText)
    .pipe(
      z
        .string()
        .min(1, 'is empty')
        .max(max, `must be at most ${max} characters`)
        .refine((value) => !hasControlCharacter(value), {
          error: 'must be plain text without control characters',
        }),
    )
    .optional();
}

export function envEmail() {
  return z
    .string()
    .trim()
    .pipe(z.email({ error: 'must be an email address' }))
    .optional();
}
