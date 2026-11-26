# Accounts API contract (milestone 2)

The backend and the frontend both implement against this document, and a change to it must be made on both sides in the same change. All paths are under `/api`. Bodies are JSON.

## Conventions
- **Errors:** `{ "statusCode": 400, "errorCode": "VALIDATION_FAILED", "message": "…", "details"?: [...], "requestId": "…" }`. `errorCode` is a stable machine code that the frontend translates. `message` is English text for logs only.
  - **`VALIDATION_FAILED`:** `details` is `[{ field, constraints: string[], messages: string[] }]`.
  - **Request body errors:** malformed JSON returns `400 INVALID_JSON`. A body over 100kb returns `413 PAYLOAD_TOO_LARGE`.
  - **Default codes:** without a specific code, the status maps to a default such as `NOT_FOUND`, `FORBIDDEN`, `RATE_LIMITED` or `INTERNAL_ERROR`.
  - **Production:** 5xx bodies carry only the status, `errorCode` and a generic message.
  - **Redis down:** auth-throttled routes return `503 RATE_LIMIT_UNAVAILABLE`. The general rate limit fails open instead.
- **Pagination:** `?page=1&pageSize=20` (`pageSize` is at most 100). Responses look like `{ "items": [...], "total": 0, "page": 1, "pageSize": 20 }`.
- **Timestamps:** ISO 8601 UTC strings. **IDs:** UUID v7.
- **No account enumeration:** register, resend-verification and forgot-password always return `202 { "ok": true }`.
- **State-changing requests** must pass the same-origin guard. Every auth endpoint has a rate limit, and going over it returns `429 RATE_LIMITED` with a `Retry-After` header.

## Cookies
All cookies are httpOnly, Secure (when `COOKIE_SECURE`) and SameSite=Strict.

| Cookie | Path | Lifetime | Purpose |
|---|---|---|---|
| `mu_at` | `/api` | `JWT_ACCESS_EXPIRATION` (15m) | Access JWT `{ sub, role, fam }` |
| `mu_rt` | `/api/auth` | `JWT_REFRESH_EXPIRATION` (30d) | Opaque refresh token, stored hashed with its family (`fam`), rotated on use, and the whole family is revoked if a token is reused |
| `mu_totp` | `/api/auth/totp` | 5m | Temporary token between the password step and the TOTP step |
| `mu_pg` | `/api` | 10m, renewed on each parent-area request | Parent-gate JWT `{ sub, fam }` |
| `mu_kid` | `/api` | 12h | Kid session JWT `{ sub: userId, kid: kidId, fam }` |

`fam` binds `mu_pg` and `mu_kid` to the refresh family, so logging out or a detected theft invalidates them too. Each cookie type is signed with its own key, derived with HKDF from `JWT_SECRET` (the dmarc `jwt-keys.ts` pattern).

## Roles and guards
- **Roles:** `parent` (the default) and `admin`. An admin can also have kids.
- **`AuthGuard`:** a valid `mu_at` is required. This is the default for every route; `@Public()` opts a route out.
- **`ParentGateGuard`:** requires a valid `mu_pg`. It applies to `/api/kids` mutations, `/api/account/*`, `/api/parent/*`, `/api/admin/*`, and the password, email and TOTP changes. Login, setup and invite-accept set `mu_pg` automatically.
- **`AdminGuard`:** requires the admin role and the parent gate. When the `requireAdminTotp` setting is on, admins without TOTP can only reach the TOTP setup endpoints (`403 TOTP_REQUIRED`).
- **`KidGuard`:** requires a valid `mu_kid` whose kid belongs to `sub`. Learning endpoints (milestone 3) use it.

## Public auth
| Method & path | Body | Success | Errors |
|---|---|---|---|
| GET `/auth/config` | – | `{ registrationEnabled, emailEnabled, setupRequired }` | |
| GET `/auth/altcha` | – | an ALTCHA challenge (from altcha-lib, HMAC `ALTCHA_HMAC_KEY`, expires after 10 minutes, single use, with spent challenges tracked in Redis) | |
| POST `/auth/setup` | `{ email, password, locale }` | `201 { user }`. Creates the first **admin**, already verified, and logs them in. Only works while the users table is empty. | `403 SETUP_COMPLETE` |
| POST `/auth/register` | `{ email, password, locale, acceptTerms: true, altcha }` | `202 { ok }`. Sends a verification email. If the email already exists, it sends that address an "account already exists" email instead. | `403 REGISTRATION_DISABLED`, `400 ALTCHA_INVALID`, `400 VALIDATION_FAILED`, `400 PASSWORD_TOO_WEAK` |
| POST `/auth/verify-email` | `{ token }` | `200 { ok, type: "registration" \| "email_change" }` | `400 TOKEN_INVALID` |
| POST `/auth/resend-verification` | `{ email, altcha }` | `202 { ok }` | |
| POST `/auth/login` | `{ email, password }` | `200 { user }`, or `200 { totpRequired: true }` with the `mu_totp` cookie set | `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED` (only after a correct password), `403 ACCOUNT_DISABLED`, `429` |
| POST `/auth/totp/verify` | `{ code }` or `{ recoveryCode }` | `200 { user }` | `401 TOTP_INVALID` |
| POST `/auth/refresh` | – | `200 { ok }` with new `mu_at` and `mu_rt` | `401 SESSION_EXPIRED`, `401 SESSION_COMPROMISED` |
| POST `/auth/logout` | – | `204`. Revokes the refresh family and clears all `mu_*` cookies. | |
| POST `/auth/forgot-password` | `{ email, altcha }` | `202 { ok }` | |
| POST `/auth/reset-password` | `{ token, password }` | `200 { ok }`. Revokes every session of the user. | `400 TOKEN_INVALID`, `400 PASSWORD_TOO_WEAK` |
| GET `/invites/:token` | – | `{ email, role, expiresAt }` | `404 INVITE_INVALID` |
| POST `/invites/:token/accept` | `{ password, locale, acceptTerms: true }` | `201 { user }`. The invite counts as email verification, and the user is logged in. | `404 INVITE_INVALID` |

**Passwords:**
- At least 10 and at most 128 characters, hashed with argon2id and stored as `argon2id$<phc>` (the prefixed format from dmarc).
- An optional HIBP k-anonymity check is controlled by the env var `PASSWORD_HIBP_CHECK` (default `false`).

**Email tokens:**
- 32 random bytes, sent base64url-encoded in the link, and stored as a SHA-256 hash.
- Types: `registration` (expires after 48h), `password_reset` (1h), `email_change` (48h). Every token is single use.

**Email links:**
- Verification: `${APP_URL}/verify-email?token=…`
- Password reset: `${APP_URL}/reset-password?token=…`
- Invite: `${APP_URL}/invite/<token>`

## Session and account (requires `AuthGuard`)
| Method & path | Body | Success | Notes |
|---|---|---|---|
| GET `/auth/me` | – | `{ user, parentGateExpiresAt: string \| null, activeKid: Kid \| null }` | |
| POST `/auth/parent-gate` | `{ password }` | `200 { parentGateExpiresAt }` | Rate-limited. Responds `401 INVALID_CREDENTIALS`. |
| POST `/auth/parent-gate/lock` | – | `204`. Clears `mu_pg`. | Used when handing the device to a kid. |
| POST `/account/password` (gate) | `{ currentPassword, newPassword }` | `200`. Revokes all other refresh families. | Sends a "password changed" notice by email. |
| POST `/account/email` (gate) | `{ newEmail, password }` | `202`. Sends an email-change verification to the new address. | |
| PATCH `/account` (gate) | `{ locale?, theme? }` | `200 { user }` | |
| GET `/account/export` (gate) | – | JSON download of all data for the user and their kids | GDPR / nFADP |
| DELETE `/account` (gate) | `{ password }` | `204`. Hard-deletes the user, their kids, their progress and their tokens. | Writes an audit entry without PII. |
| POST `/auth/totp/setup` (gate) | – | `{ otpauthUrl, qrDataUrl }` | The secret is encrypted with `ENCRYPTION_KEY` using the dmarc versioned cipher. |
| POST `/auth/totp/enable` (gate) | `{ code }` | `{ recoveryCodes: string[10] }` | |
| POST `/auth/totp/disable` (gate) | `{ password, code }` | `204` | |
| POST `/auth/totp/recovery-codes` (gate) | `{ code }` | `{ recoveryCodes }` | |

`User` = `{ id, email, role, locale: "de-CH"|"en-US", emailVerified: boolean, totpEnabled: boolean, createdAt }`

## Kids
`Kid` = `{ id, nickname, avatar: { animal, accessory: string|null, background }, startClass: "KG1"|"KG2"|"1"|"2", birthYear: number|null, language: "de-CH"|"en-US", hasPin: boolean, dailyLimitMinutes: number|null, soundEnabled: boolean, readAloud: "auto"|"on"|"off" }`

| Method & path | Body | Success | Errors |
|---|---|---|---|
| GET `/kids` | – | `Kid[]` (the profile picker works without the gate) | |
| POST `/kids` (gate) | `{ nickname (1–20 chars, letters, digits, spaces and -), avatar, startClass, birthYear?, language, pin?: number[4] (each 0–8), dailyLimitMinutes?, soundEnabled?, readAloud? }` | `201 Kid` | `400 AVATAR_INVALID`; at most 8 kids per user (`400 KID_LIMIT`) |
| PATCH `/kids/:id` (gate) | any subset of the fields above, plus `pin: null` to remove the PIN | `200 Kid` | `404 KID_NOT_FOUND` |
| DELETE `/kids/:id` (gate) | – | `204` (cascades to progress) | |
| POST `/kids/:id/activate` | `{ pin?: number[4] }` | `200 Kid`, sets `mu_kid`, and clears `mu_pg` | `401 PIN_INVALID`, `429 PIN_LOCKED` (after 5 wrong PINs in 15 min, with exponential lockout) |
| POST `/kids/deactivate` | – | `204`. Clears `mu_kid`. | |

**Avatars:** `animal`, `accessory` and `background` must be ids or colors from `brand/avatars/manifest.json`. The backend keeps a copy of the allowed ids in `src/modules/kids/avatar-catalog.ts`.

**Picture PIN:** the kid picks 4 of 9 pictures on a 3×3 grid, and the order counts. It's a gentle lock so siblings don't open each other's profiles, not a security control against parents. It is stored as argon2id of the joined indexes.

## Admin (requires `AdminGuard`)
| Method & path | Body / query | Success |
|---|---|---|
| GET `/admin/users` | `?search&page&pageSize` | paginated `AdminUser` = `User` + `{ disabled, kidCount, lastLoginAt }` |
| PATCH `/admin/users/:id` | `{ role?, disabled? }` | `200 AdminUser`. Returns `400 LAST_ADMIN` if the change would leave no active admin. Disabling a user revokes their sessions. |
| DELETE `/admin/users/:id` | – | `204` (hard delete, with the same cascade as account deletion). Admins can't delete themselves (`400 CANNOT_DELETE_SELF`). |
| POST `/admin/users/:id/resend-verification` | – | `202` |
| GET `/admin/invites` | `?page&pageSize` | paginated `{ id, email, role, expiresAt, createdAt, createdBy }` |
| POST `/admin/invites` | `{ email, role }` | `201 { invite, inviteUrl, emailStatus: "sent"\|"queued"\|"disabled" }`. The URL is shown so the admin can share it by hand. |
| DELETE `/admin/invites/:id` | – | `204` |
| GET `/admin/settings` | – | `{ registrationEnabled, requireAdminTotp, emailEnabled }` |
| PATCH `/admin/settings` | `{ registrationEnabled?, requireAdminTotp? }` | `200` |
| GET `/admin/audit-log` | `?page&pageSize&action` | paginated `{ id, at, actorId, action, targetType, targetId, ip, meta }` |
| GET `/admin/stats` | – | `{ users, kids, activeKidsLast7Days }`, counts only |

**Audit actions:** `auth.login`, `auth.login_failed`, `auth.logout`, `auth.session_compromised`, `auth.password_reset`, `auth.password_changed`, `auth.email_changed`, `auth.totp_enabled`, `auth.totp_disabled`, `account.deleted`, `admin.user_updated`, `admin.user_deleted`, `admin.invite_created`, `admin.invite_revoked`, `admin.settings_updated`, `kid.created`, `kid.deleted`, `kid.pin_locked`.

The audit log never stores kid nicknames, passwords or tokens. IPs are truncated to /24 (IPv4) or /48 (IPv6), and entries are kept for 180 days.

## Email templates
Handlebars HTML and text versions, localized by `user.locale` (or by the request `locale` at registration). The de-CH text contains no ß. Templates:
- `verify-email`
- `account-exists`
- `password-reset`
- `password-changed`
- `email-change`
- `invite`

Every email carries the static logo, referenced as an absolute `${APP_URL}/brand/murmeli-mark.png`, and the BRAND_NAME. Emails are sent through a BullMQ queue `email` with retries.

## Rate limits (defaults, configurable by env)
| Scope | Limit |
|---|---|
| login per IP | 10 / 5 min |
| login per account | 5 / 5 min, then a 15 min lock |
| register, forgot-password, resend-verification per IP | 5 / hour |
| parent-gate per user | 5 / 5 min |
| TOTP verify per temporary token | 5 attempts |
| kid PIN per kid | 5 / 15 min |
| everything else | 120 / min per IP |
