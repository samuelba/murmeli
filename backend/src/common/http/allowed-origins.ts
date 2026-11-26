import { normalizeOrigin } from '../../config/env-parsers';

export function buildAllowedOrigins(
  appUrl: string,
  corsOrigins: readonly string[],
): readonly string[] {
  const appOrigin = new URL(appUrl).origin;
  return [...new Set([appOrigin, ...corsOrigins.map(normalizeOrigin)])];
}

export function isOriginAllowed(
  origin: string,
  allowedOrigins: readonly string[],
): boolean {
  return allowedOrigins.includes(normalizeOrigin(origin));
}
