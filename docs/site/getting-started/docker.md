# Quick start with Docker Compose

This guide gets Murmeli running with the `docker-compose.yml` from the repository. The stack has four containers:

| Container | Image | Role |
|---|---|---|
| `murmeli-frontend` | `ghcr.io/samuelba/kids-learning/murmeli-frontend` | nginx: serves the app, the pictures and the narration, and proxies `/api` to the backend. The only published port. |
| `murmeli-backend` | `ghcr.io/samuelba/kids-learning/murmeli-backend` | NestJS API. Backs up and migrates the database before it starts. |
| `murmeli-postgres` | `postgres:18-alpine` | Database. |
| `murmeli-redis` | `valkey/valkey:8-alpine` | Rate limits, lockouts, running exercise rounds and the email queue. |

Images are published for `linux/amd64` and `linux/arm64` (for example a Raspberry Pi 4 or 5).

## Requirements
- Docker Engine with Docker Compose v2.23 or newer. The compose file embeds the database init script as an inline `configs` entry, which older versions don't support.
- `openssl` to generate secrets.
- For use from other devices than the server itself: a domain name and HTTPS in front of Murmeli. See [Reverse proxy and HTTPS](../deployment/reverse-proxy.md). Without HTTPS, signing in only works at `http://localhost`, because the session cookies are always marked `Secure`.

## 1. Get the files
You need `docker-compose.yml` and `.env.sample` from the repository, in one folder:

```bash
mkdir murmeli && cd murmeli
curl -fsSLO https://raw.githubusercontent.com/samuelba/kids-learning/main/docker-compose.yml
curl -fsSL -o .env https://raw.githubusercontent.com/samuelba/kids-learning/main/.env.sample
chmod 600 .env
```

The folder name becomes the Docker Compose project name, which prefixes the volume names (for example `murmeli_murmeli_backups`).

## 2. Fill in `.env`
Generate the passwords and secrets:

```bash
for name in POSTGRES_PASSWORD POSTGRES_APP_PASSWORD REDIS_PASSWORD; do
  echo "$name=$(openssl rand -hex 24)"
done
for name in JWT_SECRET ENCRYPTION_KEY ALTCHA_HMAC_KEY; do
  echo "$name=$(openssl rand -base64 48)"
done
echo "SETUP_TOKEN=$(openssl rand -base64 24)"
```

Copy each line into `.env`, replacing the empty value. Then set the public URL:

```dotenv
APP_URL=https://murmeli.example.com
```

| Variable | What it is |
|---|---|
| `POSTGRES_PASSWORD` | Password of the database owner (`POSTGRES_USER`, default `murmeli_owner`). The owner runs migrations and backups. |
| `POSTGRES_APP_PASSWORD` | Password of the least-privileged role the backend runs as (`POSTGRES_APP_USER`, default `murmeli_app`). |
| `REDIS_PASSWORD` | Password for Valkey. |
| `JWT_SECRET` | Signs the short-lived session cookies (access, parent area, kid profile). Changing it ends open kid sessions and parent-area unlocks. |
| `ENCRYPTION_KEY` | Encrypts TOTP secrets in the database. If you lose or change it, two-factor sign-in stops working for everyone who turned it on. Keep it with your backups. |
| `ALTCHA_HMAC_KEY` | Signs the proof-of-work challenges on the registration and password forms. |
| `APP_URL` | The address people type into the browser, with `https://` and without a trailing slash. Email links point there. |
| `SETUP_TOKEN` | Optional, but recommended: the setup code needed to create the first admin. |

The backend refuses to start when `JWT_SECRET`, `ENCRYPTION_KEY` or `ALTCHA_HMAC_KEY` is shorter than 32 characters, contains placeholder words such as `change-me` or `example`, or equals one of the others. It also refuses an `APP_URL` without `https`. `docker compose logs backend` lists every problem at once.

All other variables have working defaults. They are described in the [configuration reference](../reference/configuration.md).

> The two Postgres passwords are applied only when the database volume is created. Changing them in `.env` later doesn't change the roles. To change one afterwards, run `docker compose exec postgres psql -U murmeli_owner -d murmeli`, enter `\password murmeli_app` (or `\password murmeli_owner`), then update `.env` and run `docker compose up -d`.

## 3. Start
```bash
docker compose pull
docker compose up -d
docker compose ps
```

On the first start:
1. Postgres creates the database and the least-privileged role `POSTGRES_APP_USER`.
2. The backend writes a backup (of the still empty database), runs the migrations as the owner, and starts as the app role.
3. The frontend starts once the backend reports healthy. This can take up to a minute.

All four containers should show `healthy`. The app listens on port 8080 (`FRONTEND_PORT`). To try it on the server itself, open http://localhost:8080. For everything else, put a reverse proxy with HTTPS in front first: see [Reverse proxy and HTTPS](../deployment/reverse-proxy.md).

## 4. Create the first admin
While no account exists, every visit goes to the setup page.

1. Open the site. You land on **Setup**.
2. If you set `SETUP_TOKEN`, enter it as the **Setup code**.
3. Enter your email address, a password (at least 10 characters) and your language.
4. Select **Create account**. The account becomes the administrator, is already confirmed, and is signed in.

Without `SETUP_TOKEN`, the first person who opens the site becomes the admin. On a server reachable from the internet, set `SETUP_TOKEN`, or create the admin before you make the site public. The backend logs a warning while no account exists and no token is set. The token is only checked during setup, so you can remove it from `.env` afterwards.

Then add the kid profiles: see [For parents](../usage/parents.md).

## 5. Let other families in
Registration is closed by default (`REGISTRATION_ENABLED=false`). There are two ways in:

- **Invitations (works without email):** an admin invites an address under **Administration → Invitations**. Murmeli shows the invitation link, so you can send it yourself. If email is set up, it is also emailed. The link is valid for 7 days. See [For administrators](../usage/admins.md).
- **Open registration (needs email):** turn on **Registration open** under **Administration → Settings**. Anyone can then create a parent account. The form has an ALTCHA check against bots, and the account can only sign in after the address is confirmed by email.

`REGISTRATION_ENABLED` only sets the starting value. Once an admin changes the switch in the UI, the stored value wins and the variable is ignored.

## 6. Set up email (SMTP)
Murmeli sends email for address confirmation, password reset, email changes, the "password changed" notice and invitations. Add your SMTP provider's details to `.env`:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false          # true for implicit TLS on port 465; STARTTLS is used on 587 when offered
SMTP_USER=murmeli@example.com
SMTP_PASSWORD=...
SMTP_FROM="Murmeli <no-reply@example.com>"
```

`SMTP_FROM` is required when `SMTP_HOST` is set. Apply the change with `docker compose up -d`. **Administration → Settings** then says "Email sending is set up". Emails go through a queue with retries; delivery errors show up in `docker compose logs backend`.

For good deliverability, send from a domain with SPF, DKIM and DMARC records (your provider's documentation explains them). Emails load the logo from `APP_URL`, so the site must be reachable from the internet for the logo to appear.

**Without email** (`SMTP_HOST` empty), Murmeli still works, with these limits:
- Invitations show the link for you to share by hand.
- Open registration is not usable, because new accounts can't confirm their address. Keep it closed.
- "Forgot your password?", email changes and confirmation emails don't work. Parents who are signed in can still change their password in the parent area. An admin can create a password reset link for a parent, or mark an address as verified (see [Admins](../usage/admins.md)).

## Next steps
- [Reverse proxy and HTTPS](../deployment/reverse-proxy.md)
- [Security checklist](../deployment/security.md#operator-checklist)
- [Backups](../deployment/backups.md)
- [Narration audio](../learning/audio.md): the read-aloud buttons stay hidden until a rendered narration set is in place.
