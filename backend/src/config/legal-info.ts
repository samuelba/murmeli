import type { Env } from './env.schema';

export const OPERATOR_ENV_KEYS = [
  'OPERATOR_NAME',
  'OPERATOR_CONTACT_EMAIL',
  'OPERATOR_ADDRESS',
  'OPERATOR_PRIVACY_NOTE',
] as const;

/** Operator details for the legal pages; plain text, rendered as text. */
export interface LegalInfo {
  readonly operatorName: string | null;
  readonly contactEmail: string | null;
  readonly address: string | null;
  readonly privacyNote: string | null;
}

export function legalInfo(
  env: Pick<Env, (typeof OPERATOR_ENV_KEYS)[number]>,
): LegalInfo {
  return {
    operatorName: env.OPERATOR_NAME ?? null,
    contactEmail: env.OPERATOR_CONTACT_EMAIL ?? null,
    address: env.OPERATOR_ADDRESS ?? null,
    privacyNote: env.OPERATOR_PRIVACY_NOTE ?? null,
  };
}
