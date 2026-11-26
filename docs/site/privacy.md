# Privacy

Murmeli is built to store as little as possible about kids and parents, and to send nothing to third parties. This page lists what an installation stores, so operators can write their privacy notice and parents know what they agree to.

## What is stored
Everything is stored in the Postgres database of your installation.

**Parent and admin accounts**
- Email address, password hash (argon2id), role, language, theme, whether the email is confirmed, whether two-factor sign-in is on, whether the account is disabled, the time of the last sign-in, and the creation and change times.
- For two-factor sign-in: the TOTP secret, encrypted with `ENCRYPTION_KEY`, and the recovery codes as hashes.
- Sessions: a hash of each refresh token, its expiry and the browser's user agent (at most 200 characters). Expired sessions are deleted every night.
- Pending email links (confirmation, password reset, email change) and invitations: hashes of the tokens, the invited address and role, and who created the invitation. Used and expired ones are deleted every night.

**Kid profiles**
- Nickname (up to 20 characters, no real name needed), avatar (an animal, an accessory and a background color from a fixed set), starting class, learning language, picture PIN as a hash, daily time limit, sound and read-aloud settings, and the time the profile was last active.
- The database has room for an optional birth year, but the app currently never asks for it.

**Learning progress**, per kid
- Per level: best stars and score, number of rounds, when it was first passed, and whether the demo was seen.
- Per skill: mastery value, repetition box and next review date.
- Each answer: level or practice, skill, exercise type, which try, right or wrong, and how long it took. The answer itself is not stored.
- Per day: learning time and number of rounds.
- Badges and when they were earned.

**Audit log**
- Security events (sign-ins, failed sign-ins, password, email and TOTP changes, admin actions, created and deleted kid profiles) with time, action, the acting account's ID, the target's ID and an IP address cut to /24 (IPv4) or /48 (IPv6).
- No kid nicknames, passwords, tokens or email addresses.
- Entries are deleted after 180 days.

**Short-lived data** in Valkey: rate-limit and lockout counters keyed by IP address, account ID or a hash of the email address, and the running exercise round (deleted after 2 hours at the latest).

**Logs:** the frontend's access log records the client IP, method, path (without query string), status and size. The backend's request log also records request headers such as the user agent, without cookies. Both go to Docker's container logs, so the operator decides how long they are kept.

**In the browser:** the session cookies (below) and, in local storage, the device's preferred language (`mu-language`) and theme (`mu-theme`).

## What is never stored or collected
- No photos, no camera or microphone access, no location. The browser's permissions policy blocks these features.
- No real names, birth dates or addresses of kids. Kids have no email address and no password.
- No tracking: no analytics, no ads, no third-party scripts, fonts or CDNs. The app loads everything from your server.
- No answers in clear text (only right or wrong), no voice recordings of users.

## Cookies
Murmeli only sets cookies that are needed to sign in and to keep kids and parents apart. All are httpOnly, `Secure` and `SameSite=Strict`:

| Cookie | Purpose | Lifetime |
|---|---|---|
| `mu_at` | signed-in session (access) | 15 minutes |
| `mu_rt` | keeps the device signed in (refresh) | 30 days |
| `mu_totp` | between the password and the two-factor step | 5 minutes |
| `mu_pg` | parent area unlocked | 10 minutes, at most 30 |
| `mu_kid` | which kid profile is active | 12 hours |

Because they are strictly necessary, no cookie banner is needed.

## Outgoing connections
The server only connects to:
- your SMTP server, when email is set up (to send account emails),
- the Have I Been Pwned password API, only when `PASSWORD_HIBP_CHECK=true`. It receives the first 5 characters of the SHA-1 hash of a new password, never the password.

## Export and deletion
- **Export:** a parent downloads all data of their account and kid profiles as JSON under **Parent area → Account → Your data**.
- **Delete a kid profile:** deletes the profile with all its progress.
- **Delete the account:** the parent (or an admin) deletes the account, all kid profiles and all progress at once. Audit log entries stay for their 180 days, but lose every reference to the account, its kids and its IP addresses.
- **Backups** still contain deleted data until they are rotated out. The [automatic pre-migration backups](deployment/backups.md#automatic-backups-before-migrations) are kept for at most `BACKUP_MAX_AGE_DAYS` (30 days by default), except the newest one. Your own backups follow your own schedule.

## Responsibilities of the operator
*This section is general information, not legal advice.*

Whoever runs an installation for other families is the controller of their data, under the Swiss Federal Act on Data Protection (nFADP / revDSG) and, for users in the EU, the GDPR. A family that only runs Murmeli for itself is usually outside their scope. Points to consider:

- **Privacy notice and terms.** The built-in privacy and terms pages (`/privacy`, `/terms`) are drafts and don't name a contact. Publish your own notice with your identity and contact details, what you store (this page helps), why, how long, and the rights of parents.
- **Consent and children.** Accounts are for parents or legal guardians, who accept the privacy policy and the terms when they sign up. Kids only use Murmeli through a profile in a parent's account.
- **Processors.** Your hosting provider and your SMTP provider process data on your behalf. Choose them accordingly, and name them in your notice.
- **Retention.** Limit how long Docker keeps container logs, and rotate your own backups (see [Security](deployment/security.md#operator-checklist)).
- **Requests from parents.** Export and deletion are self-service. Requests by email can be handled with the admin tools: deleting an account deletes everything.
- **Security and breaches.** Follow the [security checklist](deployment/security.md#operator-checklist). Under the nFADP, a breach that likely leads to a high risk for the people affected must be reported to the FDPIC (EDÖB) as soon as possible; the GDPR has a 72-hour deadline towards the supervisory authority.
- **AI voices.** Tell users that the narration is AI-generated (see [Narration audio](learning/audio.md#ai-generated-voices)).
