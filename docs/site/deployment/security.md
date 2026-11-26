# Security

This page explains how Murmeli protects accounts and kid data, and what you as the operator still need to do.

## What Murmeli does

### Sessions and cookies
- All session data lives in httpOnly cookies with `SameSite=Strict` and `Secure`. The app's JavaScript never sees a token.
- The access cookie lives 15 minutes (`JWT_ACCESS_EXPIRATION`). The refresh token lives 30 days (`JWT_REFRESH_EXPIRATION`), is stored only as a hash, and is replaced on every use. If an old refresh token is used again, Murmeli treats it as stolen and ends every session of that sign-in.
- The parent-area unlock and the kid session are separate cookies, tied to the same sign-in. Signing out, or a detected theft, ends them too.
- Each kind of signed cookie has its own key, derived from `JWT_SECRET`.
- Changing the password, resetting it, changing the role, disabling or deleting an account ends the user's other sessions.
- State-changing requests from other websites are rejected (`Sec-Fetch-Site` and `Origin` checks). Other browser origins are only allowed when listed in `CORS_ORIGINS`.

### Parent area and kids
- The parent area (changing kid profiles, the account, administration) is behind a parent gate. Signing in unlocks it; later it asks for the password again. An unlock lasts 10 minutes, extends while the parent is active, and ends at the latest 30 minutes after the password was entered. Opening a kid profile locks it immediately.
- Wrong parent-area passwords are limited per user: after 5 within 5 minutes, the parent area stays locked for 5 minutes.
- The picture PIN on a kid profile is a gentle lock between siblings, not protection against adults. After 5 wrong PINs within 15 minutes the profile is locked, and each further lock within a day lasts twice as long.

### Passwords, sign-in and TOTP
- Passwords have at least 10 characters and are hashed with argon2id. Optionally, `PASSWORD_HIBP_CHECK=true` rejects passwords from the Have I Been Pwned breach list. Only the first 5 characters of the password's SHA-1 hash leave the server.
- Error messages never reveal whether an account exists. Registration, password reset and resending the confirmation always answer the same way.
- Rate limits, stored in Valkey, apply per IP and route (120 requests per minute, 10 per 5 minutes on sign-in and account routes, 5 per hour on routes that send email) and per account:
  - 5 failed sign-ins for one email address from one network lock that pair for 15 minutes.
  - 50 failed sign-ins for one address from all networks lock the address for an hour.
  - Wrong TOTP codes are limited per sign-in attempt and per user.
  - Each kind of account email goes to one address at most 3 times per hour.

  All limits are configurable. See the [configuration reference](../reference/configuration.md). If Valkey is down, sign-in and account routes answer 503 instead of skipping their limits.
- Registration, password reset and resending the confirmation require a self-hosted ALTCHA proof-of-work check. It needs no cookies and no third-party service.
- Parents and admins can turn on two-factor sign-in with an authenticator app (TOTP), with 10 one-time recovery codes. The TOTP secrets are encrypted with `ENCRYPTION_KEY` (AES-256-GCM). Admins can make TOTP mandatory for all admins.
- Email links (confirmation, reset, email change) are single-use, expire (1 hour for a reset, 48 hours otherwise), and are stored only as hashes. Invitation links expire after 7 days.

### Database and containers
- The backend runs as a Postgres role without DDL rights (`POSTGRES_APP_USER`). Only the owner role (`POSTGRES_USER`) changes the schema, and only in the backend's entrypoint, before the app starts. The app role can't rewrite audit entries (it may only clear their references when an account is deleted) or change recorded answers. Its queries time out after 15 seconds.
- The backend and the frontend run as non-root users, with a read-only root filesystem, all Linux capabilities dropped and `no-new-privileges`.
- The backend validates every request body against a whitelist and uses parameterized queries only. Bodies over 100 KB are rejected.
- In production the backend refuses weak or reused secrets, a missing `REDIS_PASSWORD`, `COOKIE_SECURE=false` and non-https origins, and it hides error details in responses.

### Browser
- The frontend sends a strict Content Security Policy: scripts, styles, fonts, images, audio and API calls only from the site itself, no inline scripts, no framing. It also sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, a restrictive `Permissions-Policy` (no camera, microphone or location), and cross-origin isolation headers. HSTS is optional (see [Reverse proxy](reverse-proxy.md#hsts)).
- No third-party requests: fonts, the ALTCHA widget, pictures and audio are served by Murmeli itself, and the build fails if it references an external host. There are no analytics and no ads.

### Logs and audit
- An audit log records sign-ins, failed sign-ins, password, email and TOTP changes, account deletions, admin actions and kid profile changes. It stores no kid nicknames, passwords or tokens, and IP addresses are cut to /24 (IPv4) or /48 (IPv6). Entries are deleted after 180 days.
- Access logs contain no query strings and no cookies. Invitation tokens in paths are replaced by `:token`.

## Operator checklist
**Secrets**
- [ ] Generate every password and secret with `openssl` as shown in the [quick start](../getting-started/docker.md#2-fill-in-env). Never reuse them elsewhere.
- [ ] Keep `.env` readable only by you (`chmod 600 .env`) and out of version control.
- [ ] Store a copy of `.env`, especially `ENCRYPTION_KEY`, with your backups, separate from the server.

**First start**
- [ ] Set `SETUP_TOKEN`, or create the admin before the site is reachable from the internet.
- [ ] Turn on two-factor sign-in for your admin account, then **Require two-factor sign-in for admins** under **Administration → Settings**.
- [ ] Leave registration closed unless you want strangers to sign up, and only open it with working email.

**Network**
- [ ] Serve the site only over HTTPS, with HSTS (see [Reverse proxy](reverse-proxy.md)).
- [ ] Don't expose port 8080 directly: bind it to `127.0.0.1` or use a Docker network.
- [ ] Set `TRUSTED_PROXIES` so the rate limits see real client IPs.
- [ ] Don't publish the Postgres or Valkey ports. The stock compose file doesn't.

**Operations**
- [ ] Set up regular backups that leave the server, and test a restore (see [Backups](backups.md)).
- [ ] Update regularly: watch the releases, and pull new images (see [Upgrades](upgrades.md)). Also keep the host and Docker up to date.
- [ ] Limit how long Docker keeps container logs, for example with the `max-size` and `max-file` options of the `json-file` log driver. The access logs contain full client IPs, and the backend's request logs include IPs and user agents.
- [ ] Read `docker compose logs` after each upgrade. The containers warn about missing `TRUSTED_PROXIES`, disabled HSTS and a missing `SETUP_TOKEN`.

**Email**
- [ ] Send from a domain you control, with SPF, DKIM and DMARC records, so confirmation and reset emails don't land in spam.
- [ ] Use a dedicated SMTP account or app password for Murmeli.
