# Configuration reference

Murmeli is configured with environment variables. With Docker Compose, put them in `.env` next to `docker-compose.yml` (start from `.env.sample`).

## Docker Compose
| Variable | Default | Description |
|---|---|---|
| `MURMELI_VERSION` | `latest` | Image tag for `murmeli-backend` and `murmeli-frontend`. |
| `FRONTEND_PORT` | `8080` | Host port where the app is published. |
| `POSTGRES_USER` | `murmeli` | Database user. The backend uses the same value. |
| `POSTGRES_PASSWORD` | (required) | Database password. |
| `POSTGRES_DB` | `murmeli` | Database name. |

## Backend
In production, `JWT_SECRET`, `ENCRYPTION_KEY` and `ALTCHA_HMAC_KEY` must each be at least 32 random characters, and `ENCRYPTION_KEY` must be different from `JWT_SECRET`. Generate each one with `openssl rand -base64 48`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`, `production` or `test`. Production enforces strong secrets, hides Swagger and error details. |
| `PORT` | no | `3000` | HTTP port the API listens on. |
| `LOG_LEVEL` | no | `info` | pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`. |
| `TRUST_PROXY` | no | `1` | Number of reverse proxies in front of the API, `false`, or an address/subnet list. `true` is rejected. |
| `APP_URL` | yes |  | Public base URL of the app, used in email links and always allowed as an origin. |
| `CORS_ORIGINS` | no | (empty) | Comma-separated extra browser origins allowed to call the API with credentials. No wildcards. |
| `DATABASE_HOST` | yes |  | Postgres host. |
| `DATABASE_PORT` | no | `5432` | Postgres port. |
| `DATABASE_USERNAME` | yes |  | Postgres user. |
| `DATABASE_PASSWORD` | yes |  | Postgres password. |
| `DATABASE_NAME` | no | `murmeli` | Postgres database name. |
| `DB_MIGRATIONS_RUN` | no | `true` | Run pending migrations at startup (after a backup in Docker). |
| `REDIS_HOST` | yes |  | Redis (or Valkey) host for rate limiting and queues. |
| `REDIS_PORT` | no | `6379` | Redis port. |
| `REDIS_PASSWORD` | no |  | Redis password, if the server requires one. |
| `JWT_SECRET` | yes |  | Secret for signing tokens. At least 32 random characters in production. |
| `JWT_ACCESS_EXPIRATION` | no | `15m` | Access token lifetime (`ms`, `s`, `m`, `h` or `d` suffix). |
| `JWT_REFRESH_EXPIRATION` | no | `30d` | Refresh token lifetime. |
| `ENCRYPTION_KEY` | yes |  | Key for secrets stored at rest (TOTP). At least 32 random characters in production and different from `JWT_SECRET`. |
| `COOKIE_SECURE` | no | `true` | Set the Secure flag on cookies. Only disable for plain-HTTP local development. |
| `COOKIE_DOMAIN` | no |  | Cookie Domain attribute. Leave empty for host-only cookies. |
| `SMTP_HOST` | no |  | SMTP server. Email is disabled when empty. |
| `SMTP_PORT` | no | `587` | SMTP port. |
| `SMTP_SECURE` | no | `false` | Use implicit TLS (port 465). STARTTLS is used otherwise when offered. |
| `SMTP_USER` | no |  | SMTP user name. |
| `SMTP_PASSWORD` | no |  | SMTP password. |
| `SMTP_FROM` | no |  | Sender address, required when `SMTP_HOST` is set. |
| `REGISTRATION_ENABLED` | no | `false` | Initial value of open registration. The admin setting stored in the database wins afterwards. |
| `ALTCHA_HMAC_KEY` | yes |  | HMAC key for ALTCHA proof-of-work challenges. At least 32 random characters in production. |
| `RATE_LIMIT_TTL_SECONDS` | no | `60` | Window of the default per-IP rate limit. |
| `RATE_LIMIT_LIMIT` | no | `120` | Requests per IP and route allowed in the default window. |
| `RATE_LIMIT_AUTH_TTL_SECONDS` | no | `300` | Window of the stricter `auth` rate limit on sign-in and account routes. |
| `RATE_LIMIT_AUTH_LIMIT` | no | `10` | Requests per IP and route allowed in the `auth` window. |
| `BACKUP_DIR` | no | `/app/backups` | Directory for the pre-migration `pg_dump` backups. |
| `BACKUP_MANDATORY` | no | `true` | Refuse to start when the pre-migration backup fails. |
| `BACKUP_KEEP_COUNT` | no | `10` | Number of backups to keep. |

## Frontend container (nginx)
| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://backend:3000` | Upstream for `/api/`. Only scheme, host and port, no path. |
| `HSTS_ENABLED` | `false` | Send `Strict-Transport-Security`. Turn it on only when the site is served over HTTPS. |
| `HSTS_MAX_AGE` | `31536000` | HSTS max-age, in seconds. |
| `HSTS_INCLUDE_SUBDOMAINS` | `false` | Add `includeSubDomains` to HSTS. |
| `TRUSTED_PROXIES` | (empty) | Comma-separated IPs or CIDRs of the TLS reverse proxy in front of the app. Only these may set `X-Forwarded-For` and `X-Forwarded-Proto`; when empty, clients' forwarded headers are ignored. `/0` is rejected. |
| `NGINX_RESOLVER` | from `/etc/resolv.conf` | Advanced. DNS resolver nginx uses to look up `BACKEND_URL`. |

### Reverse proxy and client IPs
When TLS terminates at a reverse proxy (Traefik, Caddy, nginx…), set `TRUSTED_PROXIES` to that proxy's address or network. The frontend's nginx then resolves the real client IP and passes exactly one `X-Forwarded-For` address to the backend, which trusts one hop (`TRUST_PROXY=1`). Rate limits rely on that IP, so without `TRUSTED_PROXIES` every visitor shares the proxy's IP.

HSTS is off by default because TLS usually ends at the reverse proxy; the container logs a warning while it is off. Enable it here, or at the proxy.

`/api/health/ready` is not reachable from outside (404). Access logs are JSON and never contain query strings.
