import { HttpContext, HttpContextToken } from '@angular/common/http';

/** The request may fail with 401 without sending the user to /login (e.g. the initial /auth/me). */
export const SKIP_SESSION_REDIRECT = new HttpContextToken<boolean>(() => false);

/** A 403 PARENT_GATE_REQUIRED on this request is returned to the caller instead of prompting. */
export const SKIP_PARENT_GATE_PROMPT = new HttpContextToken<boolean>(() => false);

/** A 401 on this request is returned as is, without a refresh (used by the refresh probe). */
export const SKIP_AUTH_REFRESH = new HttpContextToken<boolean>(() => false);

export function quietSession(): HttpContext {
  return new HttpContext().set(SKIP_SESSION_REDIRECT, true).set(SKIP_PARENT_GATE_PROMPT, true);
}
