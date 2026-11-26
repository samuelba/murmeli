export const COOKIE_ACCESS = 'mu_at';
export const COOKIE_REFRESH = 'mu_rt';
export const COOKIE_TOTP = 'mu_totp';
export const COOKIE_PARENT_GATE = 'mu_pg';
export const COOKIE_KID = 'mu_kid';

export const PARENT_GATE_TTL_SECONDS = 10 * 60;
export const PARENT_GATE_MAX_SECONDS = 30 * 60;
export const KID_SESSION_TTL_SECONDS = 12 * 3600;
export const TOTP_STEP_TTL_SECONDS = 5 * 60;

export const EMAIL_TOKEN_TTL_SECONDS = {
  registration: 48 * 3600,
  password_reset: 3600,
  email_change: 48 * 3600,
} as const;

export const INVITE_TTL_SECONDS = 7 * 24 * 3600;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;
