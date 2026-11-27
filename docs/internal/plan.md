# Murmeli: a learning platform for kids (math, reading and writing)

## Context
The repo `kids-learning` is empty: jj is initialized and there are no commits. The goal is a self-hosted web app where kids from kindergarten to the end of 2nd class learn math, reading and writing. It follows the Swiss school system and is available in German (de-CH, no ß) and American English.

Decisions already made:
- **Name and mascot:** Murmeli, a marmot.
- **Accounts:** a parent account with one profile per kid.
- **Audio:** generated offline, ahead of time, with a high-quality open-weights TTS model. The primary model is Qwen3-TTS (see §5a).
- **English:** gets its own phonics track. Math is shared between the languages.

The technical setup copies the patterns from samuelba/dmarc-report-visualizer, without SAML.

**Curriculum anchor:** Lehrplan 21 **Zyklus 1** covers the 2 kindergarten years plus the 1st and 2nd class. That is exactly the range from no knowledge to the end of 2nd class. The app should say it is "aligned with", not "affiliated with", Lehrplan 21.

---

## 1. Brand
- **Name:** *Murmeli* is Swiss German for marmot. Before writing any code:
  - Check for existing trademarks in Swissreg, EUIPO and USPTO.
  - Check whether the domains murmeli.ch, .app and .org are available.
  - Fallbacks: *Murmeli Lernpfad* or *Murmli*.
- **Learning path theme:** an Alpine trail that climbs from the valley to the summit.
  - Each topic is a "world": Zahlenwiese (number meadow), Buchstabenwald (letter forest), Rechenberg (calculation mountain), and so on.
  - Each level is a yellow Swiss hiking signpost.
  - A completed world earns a summit flag.
- **Logo** (inline SVG with CSS keyframes, the same technique as samuelba.dev):
  - Animation, a ~5 s loop: the burrow sits on a hill, the marmot pops up holding a pencil, its eyes blink, it winks with a small sparkle, then ducks back down.
  - Other uses: a static variant for the favicon and for emails, and the mascot as a "thinking" loading spinner.
  - `@media (prefers-reduced-motion: reduce)` turns the animation off.
  - Ships as an Angular component (`<mu-logo [animated]>`) and as standalone SVG files in `frontend/public/brand/`.
- **Visual style:**
  - A warm Alpine color palette: meadow green, sky blue, sun yellow (from the signposts), marmot brown, and snow white for the light theme / night blue for the dark theme.
  - Rounded shapes and large, chunky buttons.
  - All fonts are self-hosted, with no Google CDN, for GDPR and nFADP reasons. UI text uses *Nunito* or *Fredoka*. Learning content uses *Andika*, a font designed for beginning readers.

## 2. Things you might have missed (now in scope)
- **Kid login without passwords:** the parent signs in once per device. After that, kids pick their avatar and enter an optional PIN of 4 pictures. The parent area sits behind a **parent gate** (a password or parent PIN).
- **Privacy:**
  - Must comply with Swiss nFADP/revDSG and GDPR, plus COPPA if there are US users.
  - Parents give consent at registration.
  - Data minimization: a kid profile holds only a nickname, an avatar and a birth year or class.
  - No third-party trackers or CDNs. Only essential cookies, so no cookie banner is needed.
  - Data export and account deletion.
  - Privacy policy and terms pages.
- **Parent dashboard:** progress per kid, weak skills, time spent, and per-kid settings: language, starting class, daily time limit and sound.
- **Adaptive learning:**
  - A level unlocks when the previous one is mastered, at ≥80% or 2 of 3 stars.
  - Spaced repetition of weak skills in "Üben" (practice) mode.
  - Hints appear after a wrong answer.
- **Wellbeing:**
  - Stars and summit badges, but no loss-based streaks or other dark patterns.
  - A gentle break reminder.
  - A daily time limit set by the parent.
- **Accessibility:**
  - Touch targets of at least 64px in kid mode and 48px in parent mode.
  - Colors that work for colorblind kids, a high-contrast dark theme and reduced motion.
  - Exercises never depend on color alone, and everything works with a keyboard.
- **PWA:** installable on tablets, with audio and assets cached offline. Offline practice that syncs later comes in phase 6.
- **Swiss details:**
  - CHF and Rappen in the money exercises (USD in en-US), and "Viertel nach" when telling the time.
  - Large numbers use the Swiss 1'000 format, though that only matters for larger numbers.
  - The handwriting reference is Basisschrift (the Swiss school script).
- **Email deliverability:** an SMTP provider plus SPF, DKIM and DMARC.
- **Bot protection on registration:** **ALTCHA**, a proof-of-work check that is self-hosted and works without cookies.
- **Operations:**
  - Postgres backups, including a pg_dump before every migration (as in dmarc).
  - Health endpoints and container healthchecks.
  - Structured logs (pino).
  - Optional self-hosted GlitchTip later.
- **Content authoring:** exercises are data files (YAML), not code. That makes content easy to extend, review and translate.

## 3. Architecture
The layout mirrors dmarc-report-visualizer: separate `backend/` and `frontend/` folders, npm, and Node LTS.

```
backend/    NestJS 11, TypeORM, Postgres 16, Redis (BullMQ + rate limiting + caching)
frontend/   Angular (latest stable: standalone, signals, zoneless) + Angular Material M3 + custom kid theme
content/    curriculum YAML: tracks/worlds/levels/exercises, de-CH + en-US, validated by a zod schema
tools/audio offline TTS pipeline (Python, GPU Docker image, not part of runtime stack) → content/audio/{de-CH,en-US}/*.opus + manifest
docker-compose.yml / docker-compose.dev.yml (dev adds Mailpit)
.github/workflows  ci.yml + release.yml (release-please via samuelba/actions, GHCR images): see §3a
release-please-config.json / .release-please-manifest.json / CHANGELOG.md
```
Services: `postgres`, `redis`, `backend`, `frontend` (nginx serves the single-page app and audio and proxies `/api`). Every service has a healthcheck and runs as a non-root user with a read-only filesystem.

**Patterns to reuse from dmarc-report-visualizer** (read them from the scratchpad clone or GitHub):
- `backend/src/modules/auth/services/auth.service.ts`: refresh token rotation with families and theft detection.
- `backend/src/modules/auth/utils/jwt-keys.ts`: HKDF to derive a separate key per token type, plus weak-secret rejection.
- `backend/src/common/crypto/versioned-cipher.ts`: encryption at rest with key rotation, used for TOTP secrets and SMTP settings.
- `backend/src/modules/auth/services/totp.service.ts` and the recovery codes, using `otpauth` and `qrcode`.
- `backend/src/modules/auth/services/invite.service.ts`: invites stored as hashed tokens with a 7-day expiry and a cron job that cleans up expired ones.
- `backend/src/modules/auth/guards/same-origin.guard.ts` and `common/http/allowed-origins.ts`: CSRF protection without tokens, based on SameSite cookies plus `Sec-Fetch-Site` and `Origin` checks.
- `backend/src/modules/email/`: nodemailer, Handlebars templates (HTML + text), and a BullMQ queue.
- `backend/docker-entrypoint.sh`: backup, then migrate.
- `frontend/src/app/interceptors/auth.interceptor.ts`, `services/theme.service.ts` and `nginx.conf.template` with `docker-entrypoint.sh` (CSP and HSTS set from env).
- `frontend/src/app/components/{totp-*,recovery-codes-dialog,password-strength,invite-user-dialog}`.

**Planned improvements over dmarc:**
- argon2id for passwords, keeping dmarc's algorithm-prefixed hash format.
- `@nestjs/throttler` with Redis storage, plus per-account lockout kept in Redis.
- Env validation with zod at startup.
- A health endpoint.
- An open-registration toggle in `app_settings`, editable by admins.
- Email verification and password reset flows.
- pino for logging.
- helmet at the API layer, in addition to the headers nginx sets.

## 3a. CI/CD (same setup as dmarc-report-visualizer)
Copy `.github/workflows/{ci.yml,release.yml}` and `release-please-config.json` from dmarc and adapt them.

**`ci.yml`** runs on push and on pull requests to `main`:
- **Backend:** format check, lint, build, and `test:cov` with Codecov upload. Also e2e tests with Postgres and Redis service containers (with healthchecks), including the migration run.
- **Frontend:** format check, lint, build, and Vitest coverage with Codecov upload.
- **Frontend e2e:** Playwright (Chromium plus a tablet and a phone viewport). The default run uses a mocked API, as in dmarc. A live job runs against the full compose stack with Mailpit.
- **Content:** the zod schema validation of `content/`, the ß-check, a check that the audio manifest covers every string, and the env-documentation check (`scripts/check-env-docs.mjs`, as in dmarc).
- **Security:** `npm audit --audit-level=high`, a Trivy scan of both images built with `target: production` (images are not pushed), and gitleaks.
- **Pinning:** every action is pinned to a commit SHA, as dmarc does.

**`release.yml`** runs on push to `main`:
- **Release:** `samuelba/actions/release-please` (pinned SHA) opens and updates the release PR. Its config is `release-type: simple`, `bump-minor-pre-major`, `include-v-in-tag`, and `extra-files` that bump `backend/` and `frontend/` `package.json` and `package-lock.json`. If a `RELEASE_PLEASE_TOKEN` PAT is set, CI also runs on the release PR.
- **Images:** when a release is created, a `docker` matrix (`backend`, `frontend`) builds and pushes `ghcr.io/samuelba/<repo>/murmeli-{backend,frontend}`.
  - Tags: `vX.Y.Z`, `X.Y.Z` and `latest`. OCI labels are added, and the GHA build cache is used.
  - Platforms: `linux/amd64` and `linux/arm64` (arm64 so it runs on a Raspberry Pi or another home server).
  - Each image also gets an SBOM and provenance attestation.
- **Docs:** an optional `website` job publishes `docs/` to samuelba.dev, as in dmarc, behind the `WEBSITE_UPDATE` variable.

**Repo hygiene:**
- Renovate (or Dependabot) for npm packages, actions and Docker base images.
- Conventional Commits are required, because release-please builds the changelog from them. The jj workflow stays unchanged.
- A PR title lint job.

## 4. Data model (TypeORM migrations, UUID v7 keys)
- **Identity:**
  - `users`: parents and admins. Fields: email (citext, unique), password_hash, role (parent/admin), email_verified_at, locale, totp_enabled.
  - `refresh_tokens` (with family), `email_tokens` (verification, reset or email change; hashed, with expiry), `invites`, `totp_secrets`, `recovery_codes`.
  - `app_settings`: registration_enabled and SMTP settings (encrypted).
  - `audit_log`: logins, admin actions and deletions.
- **Kid profiles:**
  - `kid_profiles`: user_id, nickname, avatar (JSON config), birth_year/start_class, language, picture_pin_hash, daily_limit_min, settings.
  - `devices`: lets kids switch profiles on a trusted device.
- **Curriculum:**
  - `tracks` → `worlds` → `levels` → `exercise_sets`, plus `skills` (Lehrplan 21 competency codes).
  - Content is seeded from `content/` on startup. Each item is upserted by a stable slug and has a content_version.
- **Progress:**
  - `level_progress`: kid, level, stars, best_score, unlocked_at, completed_at.
  - `attempts`: kid, exercise_ref, answer, correct, duration_ms, hints_used, mode (`level`/`practice`).
  - `skill_mastery`: kid, skill, score, next_review_at, which drives spaced repetition.
  - `badges` and `daily_activity` (time spent and time limits).

## 5. Learning engine
- **Exercise types:**
  - Each type is a frontend component driven by a typed config. The backend generates and checks the exercises, and the client only renders them.
  - Generators use seeded randomness, which gives endless optional practice for each skill.
- **Math types, Zyklus 1:**
  - Number sense: counting objects, recognizing numbers by sight (Zehnerfeld, Zwanzigerfeld and Hunderterfeld fields), and Zahlenstrahl (number line).
  - Number structure: comparing with <, > and =, and Zahlzerlegung (number bonds) in the Zahlenhaus format.
  - Calculating: adding and subtracting to 10, 20 and then 100, Rechenmauer (number wall), and Einmaleins (times tables) in the 2nd class.
  - Shapes, measurement and money: patterns, shapes, the clock, CHF money, and measuring.
  - Short word problems that are read aloud.
- **German literacy types:**
  - Sounds and letters: Anlaut (initial sound), picture matching in the style of the initial-sound charts used in schools, and letter recognition.
  - Handwriting: **tracing letters on a canvas** with the correct stroke order, using Basisschrift paths with tolerance scoring.
  - Syllables: Silben klatschen (clapping out syllables) and blending syllables.
  - Building and reading words: building words from letter tiles, reading a word and picking the matching picture, and a light dictation (listen and write).
  - Sentences: reading a sentence and answering a question about it, and capitalizing nouns.
- **English literacy types:** US phonics order (s, a, t, p, i, n…), CVC words, sight words, tracing, and the same tile, picture and dictation mechanics as the German track.
- **Self-explanatory UX:**
  - Every level opens with a ~20 s animated **"Zeig mir" ("show me")** demo, in which Murmeli solves an example step by step.
  - Every instruction has a 🔊 button and is read aloud automatically while the kid is in pre-reader mode.
  - The kid gets feedback right away, with gentle animations. After a mistake, a step-by-step hint appears.
- **Unlocking:**
  - Levels within a world unlock in order.
  - New worlds unlock when the worlds they depend on are mastered.
  - Parents can set the starting class, which skips earlier levels and marks them as passed.
- **Audio:** see §5a. The app looks up audio in the manifest and composes math prompts from number clips.

## 5a. Offline TTS pipeline (`tools/audio`)
**Engine choice.** Audio is rendered once, at build time, so the slower, higher-quality models that need a GPU are affordable.

| Engine | License | German + English | Role |
|---|---|---|---|
| **Qwen3-TTS** (1.7B, 12 Hz) | Apache-2.0 | yes, both (10 languages) | **Primary.** VoiceDesign creates the narrator voice from a text description, and the Base model clones that voice for every clip. |
| Orpheus TTS 3B (+ German research finetune) | Apache-2.0 | English very good, German is a research release | Fallback for English, or for any German clips where Qwen does worse. |
| Fish Audio S2 Pro | Fish Audio Research License (non-commercial) | yes | **Excluded.** Commercial use needs a separate license, and the license also restricts what the outputs can be used for. |
| Piper | MIT | yes | CPU-only placeholder for development and CI, so a GPU isn't needed to run tests. |

**Pipeline steps** (each engine implements a common `TtsEngine` interface, so models can be swapped or compared):
1. **Extract.** Collect every speakable string from `content/**/*.yaml`, the i18n JSON files and the number-clip lexicon. Each string becomes a job with a key built from `{locale, text, voice, engine, engine_version}`.
2. **Voice design.** Do this once per locale with Qwen VoiceDesign, using a description like "warm, friendly, clear female or male narrator, slow pace, for 5–8 year olds". German uses Standard German (Hochdeutsch), which is what Swiss schools teach.
   - Keep 2–3 candidate voices for each locale, and pick the final ones by listening to them.
   - Save the chosen voice's reference clip in `tools/audio/voices/`, so every later clip sounds like the same narrator.
3. **Render.** Generate each clip by cloning the reference voice. Content-hash caching means only new or changed strings get rendered again.
4. **ASR check.** Transcribe each clip with Whisper (large-v3, run locally) and compare the transcript to the source text by word error rate.
   - LLM-based TTS can hallucinate, skip or repeat words. A clip that fails the check is re-rendered with a new seed up to N times.
   - Clips that still fail are flagged for review.
5. **Post-process with ffmpeg.** Trim the silence at the start and end, normalize loudness to EBU R128 (around −16 LUFS for mobile), and encode to Opus at 48 kbps mono.
6. **Manifest.** Write `manifest.json` mapping each key to the file plus its duration. The frontend and service worker read it.
7. **Review UI.** A small local HTML page that lists flagged or new clips with play, approve and re-roll buttons.

**Special cases:**
- **Isolated sounds** (/m/, /sch/, the "s" in "sun") are unreliable with any TTS model.
  - Render each sound inside carrier words: "M wie Maus" (M as in mouse), "s as in sun".
  - Keep a short `phonemes/` list for **human recordings**, which take priority over TTS clips in the manifest.
- **Numbers:** clips for 0–100, the operators and short sentence frames, so math prompts can be assembled ("Wie viel ist" + "7" + "plus" + "5" + "?"). Prosody is checked by ear on a sample.
- **Determinism and versioning:** model checkpoints are pinned by hash. Changing the model or the voice creates new keys, which triggers a full re-render on purpose.
- **Storage:** the rendered Opus files are committed with Git LFS or published as a versioned asset bundle. The rendering job doesn't run in CI, because CI has no GPU; CI only checks that the manifest covers every string.
- **Disclosure:** the about page states that the voices are AI-generated.

## 6. Accounts and admin flows
- **Registration:**
  - Only available when `registration_enabled` is on. Otherwise people join by invite.
  - The form asks for email, password and parental consent, and includes ALTCHA.
  - A verification email is sent, and the account cannot log in until the email is verified.
  - Plus-addressed emails such as `example+kid1@gmail.com` are accepted as normal addresses. They are no longer needed, though, because profiles cover multiple kids.
- **First admin:** created by the setup flow (the dmarc `SetupGuard` pattern) or from an env bootstrap.
- **Admin features:**
  - User list and search, invite, resend verification, disable or delete users (delete cascades to kids and progress), and change roles.
  - Registration toggle, SMTP settings, audit log, and stats (counts only, no kid data).
- **Optional TOTP** for parents and admins. Admins can be required to use it.
- **Social sign-in** comes later. The data model already allows it through a nullable `auth_providers` table.

## 7. Security checklist
- **Sessions:** httpOnly, Secure, SameSite=Strict cookies, refresh token rotation and reuse detection, and short-lived access tokens.
- **Cross-site requests:** same-origin guard plus a CORS allowlist.
- **Passwords and secrets:**
  - argon2id hashing and a minimum length of 10.
  - Optional HIBP check (k-anonymity), which can be turned off.
  - Secrets come from env or Docker secrets and are validated at boot.
- **Brute-force protection:**
  - Redis-backed rate limits per IP and per account on login, register, reset, verify, invite and picture PIN.
  - Exponential lockout.
- **Input and output:**
  - ValidationPipe with whitelist and forbidNonWhitelisted on every DTO.
  - Parameterized queries only.
  - Generic error messages that don't reveal whether an account exists.
- **Headers:**
  - Strict CSP with no inline scripts (the logo animation is CSS, so it is CSP-safe).
  - HSTS, Referrer-Policy, Permissions-Policy and frame-ancestors none.
- **Supply chain:** npm audit, Renovate, Trivy image scans, an SBOM, and pinned base images.
- **Audit:** an audit log, and a security-reviewer pass before every release.

## 8. i18n
- **Library:** Transloco for runtime switching, since each kid profile can have a different language than the parent.
  - Locales are `de-CH` and `en-US`.
  - Content YAML has a `de-CH` field and an `en-US` field per string.
  - Kid mode (an active kid outside `/parent` and `/admin`) uses the kid profile's language and hides the top-bar switch; grown-up pages use the account locale. `SessionLanguage` applies this, and `KidMode` decides who is in front of the screen.
- **ß-check:** a CI script that fails if `ß` appears in any de-CH file (i18n JSON, content YAML or email templates).
- **Formatting:** dates, numbers and currency use Angular locale data for de-CH and en-US.

## 9. Milestones (each one gets jj commits in Conventional Commits format)
0. **Brand:** name check, animated logo SVG, mascot poses, color tokens, avatar set (~30 funny Alpine animals, each with background color and accessory options, no photos).
1. **Foundation:**
   - Scaffold backend and frontend, compose files (dev and prod), healthchecks, env validation.
   - CI and release workflows (§3a): release-please and GHCR image publishing from the first commit. ESLint/Prettier, Jest/Vitest/Playwright set up.
2. **Accounts:**
   - Registration with toggle, verification, login and refresh, reset, TOTP, invites.
   - Admin UI, kid profiles, avatar picker, picture PIN, parent gate, audit log, rate limits, ALTCHA.
3. **Learning engine:** content schema and seeder, progression and unlock service, attempts API, exercise player shell, audio service, "Zeig mir" demo framework.
4. **Content M1:**
   - Math from kindergarten to 1st class, German literacy from kindergarten to 1st class.
   - Audio pipeline, starting with a Qwen3-TTS bake-off against Orpheus on about 50 representative clips per locale before the full render, plus the first ~15 exercise types.
5. **Content M2:** math and German for the 2nd class, Einmaleins, the English phonics track, handwriting tracing.
6. **Polish:**
   - Parent dashboard, badges, time limits, PWA and offline mode.
   - Accessibility audit, performance work, privacy pages, deployment docs, backups.

## 9a. Continuous review (a gate after every step, not only at the end)
Every feature slice goes through this loop before it is committed:
1. **Write the tests first** for logic: services, generators, checkers and guards.
2. **Implement**, then `/verify`: build, lint, tests and coverage.
3. **Independent review by subagents.** They are given the diff, not my conclusions, and run in parallel:
   - `typescript-reviewer` and `code-reviewer` on every change.
   - `security-reviewer` on anything that touches auth, sessions, tokens, rate limits, input handling, email, admin features or headers.
   - `database-reviewer` on every migration and entity change.
   - `ecc:a11y-architect` on new kid-facing UI components: touch targets, contrast, motion and screen reader labels.
4. **Fix** every CRITICAL and HIGH finding, then run review again until no CRITICAL or HIGH findings remain. MEDIUM findings are fixed or noted in the commit or PR.
5. **Commit** with jj in Conventional Commits format.

**At the end of each milestone:**
- `/code-review` on the full milestone diff.
- A UI check with Playwright screenshots on phone, tablet and desktop, in light and dark themes.
- A short summary for you: what was built, the review findings and how they were resolved, and open questions.

**Content and audio:** every new world gets a review of its curriculum mapping against Lehrplan 21 Zyklus 1, the ß-check, and a listening pass in the audio review UI before it ships.

**Before the first release:** a full `ecc:security-review` pass, an OWASP ZAP baseline scan, Trivy and `npm audit`, and a privacy check that no kid data is exposed and no third-party requests are made.

## 10. Verification
- **Backend:**
  - Jest unit tests for services, generators and checkers, plus fast-check property tests for the math generators.
  - Supertest e2e tests against Testcontainers (Postgres and Redis).
  - Target: ≥80% coverage.
- **Frontend:** Vitest component tests, plus Playwright e2e on desktop, iPad and phone viewports.
  - Flows: register → verification email (Mailpit) → login → create kid → complete a level → next level unlocks → practice mode → admin disables registration → invite flow.
- **Security:** OWASP ZAP baseline scan against the dev compose stack, a Trivy image scan, `npm audit`, and a check that rate limits kick in (a scripted burst gets 429).
- **Manual check:** `docker compose -f docker-compose.dev.yml up`, then try the app on a real tablet over the LAN: touch, audio, offline cache and both themes.
- **Lighthouse:** accessibility ≥95 and the PWA criteria in CI.
