# Murmeli frontend

Angular 22 (standalone components, signals, zoneless), Angular Material 22 (M3, custom kid theme) and Transloco (`de-CH`, `en-US`).

## Commands

| Command                                      | What it does                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm start`                                  | Dev server on http://localhost:4200, proxies `/api` to `BACKEND_URL` (default `http://localhost:3000`)                                                                                                       |
| `npm run build`                              | Production build into `dist/murmeli-frontend/browser`                                                                                                                                                        |
| `npm run check:external`                     | Fails if the build references any third-party host                                                                                                                                                           |
| `npm test`                                   | Unit tests (Vitest through `@angular/build:unit-test`)                                                                                                                                                       |
| `npm run test:coverage`                      | Unit tests with coverage; fails below 80%                                                                                                                                                                    |
| `npm run lint`                               | `brand:check`, then ESLint (angular-eslint)                                                                                                                                                                  |
| `npm run brand:sync`                         | Copies `../brand` assets into `public/brand/`, `src/styles/_brand-tokens.scss` and the avatar manifest, and writes `public/manifest.webmanifest`                                                             |
| `npm run brand:check`                        | Fails if those copies are out of date; skips when `../brand` is missing (Docker build)                                                                                                                       |
| `npm run content:sync`                       | Copies `../content/pictures` into `public/pictures/`, writes `src/app/learn/content/learn-content.json`, and copies `../content/audio` (if any) into `public/audio/` (staged, then swapped in with a rename) |
| `npm run content:check`                      | Fails if the pictures or the learn content JSON are out of date (run by `lint`)                                                                                                                              |
| `npm run format:check`                       | Prettier                                                                                                                                                                                                     |
| `npm run e2e`                                | Playwright (desktop, iPad, Pixel) against `ng serve` with a mocked API; the service worker tests run against the production build served by `serve:dist`                                                     |
| `npm run serve:dist`                         | Serves `dist/` like the nginx image (CSP, cache headers, gzip, SPA fallback) on port 4301; `--mock guest\|family\|kid` adds a tiny fake backend                                                              |
| `npm run lighthouse`                         | Lighthouse (mobile) on the landing page, the profile picker and the map of the production build; fails below performance 85, accessibility 95, best practices 95                                             |
| `npx playwright test -c e2e/shots.config.ts` | Screenshots of the map, the flow and every exercise type (phone and tablet, light and dark) into `e2e-results/shots` (`SHOTS_OUT`, `TYPES`, `THEMES`)                                                        |

Set `E2E_BASE_URL` to run the e2e suite against an already running server, for example the nginx container (the service worker tests then use it too). Service workers are blocked in every other test, because `page.route` cannot see what a service worker answers; `pwa.spec.ts` turns them on and mocks `/api` on the browser context instead. The e2e suite mocks every `/api` call with `e2e/helpers/mock-api.ts` and the stateful fake backend in `e2e/helpers/family.ts` (it even serves real, cheap ALTCHA challenges), and runs axe-core on the main pages.

The learning API is faked by `e2e/helpers/learn-fixtures.ts` on top of the real content runtime (`generateRun`, `checkAnswer`, `starsFor` … from `@murmeli/content`), so items, demos, hints, scoring and unlocking behave like the backend. `e2e/pages/player.page.ts` answers every exercise type right or wrong like a kid would. `/audio/**` is served from `e2e/fixtures/audio` (a three-clip manifest). The content package is a symlinked ESM build, so `playwright.config.ts` loads `content/dist` untranspiled (`build.external`).

The content package must be built before the frontend is installed, linted, tested or built: `cd ../content && npm ci && npm run build`.

## Layout

- `src/app/core/`: brand name, HTTP (`ApiService`, interceptors), auth (`AuthService`, guards, parent gate), API models and services (kids, account, admin), error mapping, form validators, avatar catalog, i18n, theme and storage.
- `src/app/shared/`: `mu-logo`, `mu-mascot`, `mu-avatar`, `mu-avatar-builder`, `mu-pin-pad`, `mu-speak`, `mu-altcha`, dialogs and form helpers.
- `src/app/layout/`: app shell (top bar, theme toggle, language switch, session menu).
- `src/app/pages/`: lazy-loaded routes (public auth pages, profile picker, `parent/**`, `admin/**`).
- `src/app/learn/`: the learning area (`/learn` trail map, `/learn/level/:levelId` and `/learn/practice` player), see below.
- `src/styles/`: `_brand-tokens.scss` (copy of `brand/tokens/tokens.css`, the source of truth), `_tokens.scss` (app aliases and self-hosted font names on top), `_theme.scss` (Material M3), `_base.scss`, `_forms.scss`. `_theme-colors.scss` is generated by `ng generate @angular/material:theme-color` from the brand colors (primary `#1F6FB8`, secondary `#2E7D4F`, tertiary `#F7C600`).

## Brand

`brand/` is the source of truth. `npm run brand:sync` copies it into the frontend; the copies are committed, and the Docker build does not run the brand sync. Material uses the brand blue as `primary` (AA as text and as a fill), and filled buttons use the signpost yellow with dark text (12:1). The animated logo is inlined in `mu-logo` (keyframes in its SCSS, off under `prefers-reduced-motion`).

## Auth and sessions

The API contract is `docs/internal/api-accounts.md`. Sessions are httpOnly cookies, so the app never sees a token:

- `AuthService` loads `/api/auth/config` and `/api/auth/me` on startup (a 401 just means "signed out") and holds `user`, `activeKid`, `parentGateExpiresAt`, `isAdmin` and `hasParentGate` as signals.
- `authInterceptor`: a 401 (other than wrong-secret codes such as `INVALID_CREDENTIALS`, `PIN_INVALID`, `TOTP_INVALID`) triggers one shared `POST /api/auth/refresh` and a single retry. Across tabs, refreshes are serialized with the Web Locks API (`mu-refresh`); after getting the lock, a `/auth/me` probe skips the refresh when another tab already rotated the cookies. Only a 401 from the refresh ends the session (clear, then `/login?returnUrl=…`); 429, 5xx and network errors keep it.
- `parentGateInterceptor`: a `403 PARENT_GATE_REQUIRED` opens the parent-gate dialog and retries once after unlocking.
- `totpRequiredInterceptor`: a `403 TOTP_REQUIRED` (admins, when `requireAdminTotp` is on) opens the TOTP section of `/parent/account` with an explanation.
- The UI language follows the session (active kid, else the account locale) without overwriting the device preference, which comes back after logout.
- Guards: `authGuard`, `guestGuard`, `setupGuard`/`setupPageGuard`, `parentGateGuard` (dialog; cancel goes back to the profile picker), `adminGuard`, `kidGuard`.
- `errorCode`s map to `errors.<CODE>` translations; 429 messages show the `Retry-After` time.

## ALTCHA and the CSP

Registration, resend-verification and forgot-password use the self-hosted `altcha` widget (v3, matching `altcha-lib` v2 on the backend). The app loads the CSP-friendly `altcha/external` build: its stylesheet is part of the global styles, and the PBKDF2/SHA workers are copied to `/altcha/*.js` and started with `new Worker('/altcha/…')`. The CSP allows them with `worker-src 'self'`: no `blob:` workers, no inline scripts. The default `altcha` bundle would need `worker-src blob:`, so don't switch to it.

- `public/i18n/`: translations. `de-CH` never uses the Eszett (it writes "ss"); a unit test checks that and that both files have the same keys.
- Fonts (Nunito, Andika) are self-hosted from `@fontsource` packages. No CDN, no external requests.

Kid mode: put `.mu-kid-mode` on a container to raise touch targets from 48px to 64px. Every kid-facing instruction has a `<mu-speak [text]>` (or `[segments]` for a prompt's `speak` list). It is hidden while the narration has no clip for the text.

## Learning (milestone 3)

The contract is `docs/internal/learning-engine.md`. Payload, answer and API types come from `@murmeli/content` (`"file:../content"`) with `import type` only, so no content code ends up in the bundle.

- **Map** (`learn/map/`): one Alpine trail per track (tabs), worlds as scene bands from the valley (first world, bottom) up, levels as yellow signposts with 0–3 stars. Locked levels shake and say why; Murmeli stands at the next level; completed worlds get a summit flag.
- **Player** (`learn/player/`): `PlayerStore` is the state machine (`loading → demo → playing ⇄ checking → feedback → … → finishing → results`, plus `resting` for `403 DAILY_LIMIT_REACHED` and `error` with retry). A wrong first answer shows the hint (`HINTS` text) and the item starts fresh; the second wrong answer reveals the solution. Unknown exercise types from a newer server are skipped.
- **"Zeig mir"**: the demo instance is rendered by the same exercise component (locked), with each step's action as a `cue` (highlight, count along, hop, clap, place tiles, fill blank, tap answer with a pointing hand) and Murmeli saying the step.
- **Exercises** (`learn/exercises/`): one component per type on `ExerciseBase` (`payload`, `locked`, `reveal`, `cue` in, `answered` out). Single-tap answers submit at once; keypad answers, number house, number wall, number line (place), drum and word building have an explicit "Prüfen" button. Shared pieces: `mu-choices`, `mu-keypad` (also digits, Backspace and Enter on a keyboard), `mu-value-answer`, `mu-frame-grid`, `mu-quantity`, `mu-picture` (`/pictures/<id>.svg`, alt = the word).
- **Audio** (`core/audio/`): `AudioService` is the `SPEAK_PROVIDER`. It loads `/audio/manifest.json` (the `tools/audio` format) once, maps text → clip per locale, plays `prompt.speak` segments back to back with a 120 ms gap on one reusable `<audio>`, and stops on a new speech, `stop()` or navigation. Missing clips are skipped (`console.debug` in dev). Prompts, hints and feedback play on their own only when the kid's `readAloud` asks for it (`auto` = KG1/KG2); the speak button always works. `SoundEffects` makes the correct/wrong/star/complete sounds with Web Audio oscillators and follows `soundEnabled`. Both unlock on the first tap (Safari autoplay).
- **Spoken UI strings** live under `kid.feedback.*`, `kid.navigation.*` and `kid.badges.*` (no placeholders), the globs in `tools/audio/speakable-i18n-keys.txt`. Feedback phrases and hints come from the content package (`learn-content.json`), so they match the manifest texts.
- **Narration files**: `npm run content:sync` copies `../content/audio` into `public/audio/` (gitignored). For a local test with another render use `node scripts/sync-content.mjs --audio-from ../tools/audio/out` (or `MURMELI_AUDIO_DIR`).

## Parent progress (milestone 6)

`/parent/kids/:id/progress` (behind the parent gate, linked as "Fortschritt" on every kid card) shows `GET /api/parent/kids/:id/progress`. `pages/parent/progress/parent-progress.types.ts` is a copy of the backend's `backend/src/modules/learning/parent/parent-progress.types.ts`; keep both equal until the type moves into `content/schema/api.ts`.

- Overview: avatar, class, stars, levels passed, time and rounds in the last 14 days, badges with their names, and a short "good to know" about stars, confidence and review.
- Activity: two small SVG column charts (minutes, rounds; one measure each, no second axis), drawn in real pixels for the measured width, with the peak labeled, a native tooltip per day and a text summary as the accessible name. Every value is also in a table under "Werte als Tabelle anzeigen". Colors are the theme tokens (`--mu-color-secondary`, `--mu-color-meadow-strong`), so dark mode and forced colors follow.
- Skills, weakest first: confidence as a bar plus its percentage and a word ("braucht Übung", "wird sicherer", "sitzt gut"), never color alone; the backend's `weakSkills` get a "Braucht Übung" tag; next review date or "due now".
- Tracks → worlds (`<details>`, the current world open) → levels with stars as `role="img"` text, state and runs.
- `progress-view.ts` holds the pure mapping (chart scale, ticks, peak, mastery levels, totals).

## Badges

`learn/badges/`: the shelf on the trail map (trophy button with the count, a kid-sized dialog with all four badges: earned ones shine, the others say how to get them) and the "Du hast ein neues Abzeichen!" block on the results screen. The map response has no badges yet, so `KidBadges` combines what the map proves (first level, first summit, five times three stars), an optional `badges` array on the map response (for a newer backend) and the `newBadges` of finished runs, which it keeps per kid in `localStorage` (badge ids only). Spoken names live under `kid.badges.*` (no placeholders).

## Service worker and offline

The Angular service worker (`ngsw-config.json`, registered in production builds) works under the strict CSP (`script-src 'self'`, `worker-src 'self'`): it is a same-origin script with no inline code.

- App shell (index, hashed JS/CSS, fonts, i18n, ALTCHA workers, mascot) is prefetched; `/brand/**` and `/pictures/**` are cached on first use (cache first, refreshed with each new version).
- `/audio/manifest.json` is network first (4 s timeout); clips are cache first in a cache of at most 400 clips. When a run starts, the player prefetches that run's clips (prompts, demo, feedback).
- `/api/**` is never cached: no data group matches it and it is excluded from navigation handling; nginx sends `no-store`. `pwa.spec.ts` checks the caches.
- Updates: `AppUpdates` (`core/pwa/`) listens to `SwUpdate`. In the parent and admin area a snackbar offers "Neu laden"; elsewhere the update waits and is applied on the next visit to the profile picker, so a kid is never interrupted. It also checks for updates every hour.
- Offline: `NetworkStatus` follows `navigator.onLine`. Kid pages are replaced (not destroyed) by a sleeping Murmeli; parent pages keep their content and get a banner. An app that started offline reloads once the connection is back.
- nginx serves `ngsw-worker.js`, `ngsw.json`, `safety-worker.js` and `worker-basic.min.js` with `no-cache` and a 404 instead of the SPA fallback. Uninstall in an emergency by deploying `safety-worker.js` as `ngsw-worker.js`.

## Wellbeing and other pages

- **Break reminder**: `BreakTimer` sums the time on player pages; five idle minutes or the profile picker start it over. After 20 minutes the player shows a full-screen "Zeit für eine kleine Pause?" between two items (never mid-item), with "Weiter spielen" and "Pause machen" (back to the profile picker). The next reminder is 20 minutes of play later.
- **Zeig mir**: the demo plays by itself only when `demoSeen` is false; the "Zeig mir" button replays it whenever the run has one.
- **Keypad**: one confirm control everywhere, the labeled "Prüfen" button under the pad (the pad itself has digits and delete, laid out like a phone). Enter on a keyboard still confirms; in the number house and wall, "Prüfen" with blanks left moves to the next empty blank.
- **About** (`/about`, footer): what the app is, Lehrplan 21 (aligned with, not affiliated), the AI voice disclosure (Qwen3-TTS), credits and licenses, and the version (`core/version.ts` imports only `version` from `package.json`, which release-please bumps).
- **Operator**: privacy and terms show `legal` from `GET /api/auth/config` (name, address, contact email, a privacy note on the privacy page) or a neutral "run by whoever hosts this instance" note.
- **Admin users**: "Passwort-Link erstellen" (`POST /api/admin/users/:id/password-reset-link`, shown once in a dialog with a copy button) and, for unverified accounts, "E-Mail als bestätigt markieren" (`POST /api/admin/users/:id/verify-email`).

## Lighthouse

`npm run build && npm run lighthouse` audits the landing page (signed out), the profile picker and the trail map with mobile emulation. Lighthouse 12+ has no PWA category any more; installability is checked in `pwa.spec.ts` with Chromium's `Page.getInstallabilityErrors`.

## Container

`docker build -f frontend/Dockerfile --target production .`, run from the repository root (the image needs `content/`), builds an `nginxinc/nginx-unprivileged` image that listens on 8080, runs as a non-root user and works with a read-only root filesystem (it renders its config into `/tmp`).

| Variable                  | Default                 | Purpose                                                                                                                          |
| ------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_URL`             | `http://backend:3000`   | Upstream for `/api/` (scheme, host and port only)                                                                                |
| `TRUSTED_PROXIES`         | empty                   | Comma-separated IPs/CIDRs of the TLS reverse proxy. Only these may set the client IP (`X-Forwarded-For`) and `X-Forwarded-Proto` |
| `HSTS_ENABLED`            | `false`                 | Send `Strict-Transport-Security` (a warning is logged while it is off)                                                           |
| `HSTS_MAX_AGE`            | `31536000`              | HSTS max-age in seconds                                                                                                          |
| `HSTS_INCLUDE_SUBDOMAINS` | `false`                 | Add `includeSubDomains` to HSTS                                                                                                  |
| `NGINX_RESOLVER`          | from `/etc/resolv.conf` | DNS resolver used to look up `BACKEND_URL`                                                                                       |

nginx sends the backend `X-Forwarded-For` with exactly one address, the real client, so the backend should trust only this hop. `/api/health/ready` is answered with 404 at nginx; the backend health check calls the backend directly. Access logs are JSON lines with the client IP, method, path (without the query string), status, bytes and duration; no referrer, user agent or cookies.

`/healthz` returns 200 for health checks. `/audio/manifest.json` is revalidated (`no-cache`); clips are requested with `?v=<manifest version>` and cached for a year, served as `audio/ogg`. The image contains `content/audio` when it exists at build time; otherwise mount a rendered set read-only at `/usr/share/nginx/html/audio`. Without a manifest the read-aloud buttons stay hidden. `/pictures/` is cached for a day and gets an extra sandboxing CSP. `/manifest.webmanifest` is served as `application/manifest+json`. `/brand/` assets send `Cross-Origin-Resource-Policy: cross-origin` so email clients can show the logo; everything else stays `same-origin`.

The CSP adds `upgrade-insecure-requests` only when `HSTS_ENABLED=true`. That is not a plain-http mode: in production the backend requires an https `APP_URL` and sets `Secure` cookies, so put TLS in front (the reverse proxy). The entrypoint warns when `TRUSTED_PROXIES` is empty, because behind a reverse proxy all clients would then share one IP for rate limiting. Invite tokens in paths (`/invite/<token>`, `/api/invites/<token>[/accept]`) are logged as `:token`.
