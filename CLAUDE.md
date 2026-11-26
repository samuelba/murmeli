# Murmeli: project conventions

Murmeli is a self-hosted learning platform for kids, from kindergarten to the end of 2nd class (Lehrplan 21, Zyklus 1). It covers math, reading and writing in German (de-CH) and American English (en-US). The full plan is in `docs/internal/plan.md`.

## Layout
- `backend/`: NestJS, TypeORM (Postgres) and Redis (BullMQ queues, rate limiting).
- `frontend/`: Angular, with standalone components, signals and zoneless change detection, plus Angular Material M3, a custom kid theme and Transloco.
- `content/`: the curriculum as YAML, validated by `content/schema`.
- `brand/`: the logo, the mascot, the avatars and the design tokens. This folder is the source of truth; the frontend copies from it.
- `tools/audio/`: the offline TTS pipeline (Qwen3-TTS). It does not run as part of the app.
- `docs/site/` is the user manual. `docs/internal/` holds developer notes.

## Rules
- **Version control:** jj, with Conventional Commits. release-please builds the changelog from the commit messages.
- **No ß in German.** The de-CH text uses "ss". `scripts/check-no-eszett.mjs` enforces this in CI.
- **Brand name:** "Murmeli" is a working name. Use `BRAND_NAME` (frontend `src/app/core/brand.ts`, backend `src/config/brand.ts`) and don't hard-code the name in templates.
- **Kid privacy:**
  - Kid profiles store only a nickname, an avatar, a birth year or class, and settings.
  - No photos, no third-party requests (no CDNs, fonts or analytics), and only essential cookies.
- **Touch targets** are at least 64px in kid mode and at least 48px in parent and admin mode. Honor `prefers-reduced-motion`.
- **Security:**
  - Validate every DTO, which the global ValidationPipe enforces with whitelist and forbidNonWhitelisted. Parameterized queries only.
  - Error messages must not reveal whether an account exists.
  - Every auth-adjacent endpoint is rate-limited.
- **Comments:** keep inline comments minimal. Code should explain itself.
- **Tests:** write them first for logic. Coverage must stay at or above 80%.
- **Docs:** update the docs in the same change (see `.claude/rules/documentation.md`).
