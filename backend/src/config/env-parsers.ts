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
