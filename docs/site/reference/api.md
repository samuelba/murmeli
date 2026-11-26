# API

Murmeli's HTTP API under `/api` exists for its own web app. It is not a public, stable API: routes and response shapes can change in any release without notice, and there are no API keys. Sessions use the same httpOnly cookies as the browser, and state-changing requests from other websites are rejected.

Two endpoints are meant for operators:

| Endpoint | Purpose |
|---|---|
| `GET /healthz` | Health check of the frontend container (nginx). Answers `200 ok`. |
| `GET /api/health` | Health check of the backend, used by its container health check. |

`/api/health/ready` is only reachable inside the Docker network; the frontend answers 404 for it.

## For developers
The contracts the backend and the frontend implement are in the repository:

- [Accounts API](../../internal/api-accounts.md): sign-in, sessions and cookies, parent gate, kid profiles, account and admin routes, error codes and rate limits.
- [Learning engine](../../internal/learning-engine.md): content format, exercise types, runs, scoring, unlocking and the learning routes.
- [Backend README](../../../backend/README.md): modules, guards and the learning routes.

Outside production (`NODE_ENV` other than `production`), the backend also serves interactive Swagger documentation at `/api/docs`. See [DEVELOPMENT.md](../../../DEVELOPMENT.md) to run it locally.
