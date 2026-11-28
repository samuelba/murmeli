# Development

## Prerequisites
- Node 24 LTS and npm 12
- Docker with Compose v2
- jj (Jujutsu) for version control. Commits follow [Conventional Commits](https://www.conventionalcommits.org/), and release-please builds the changelog from them.

## Services for local development
```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres 18, Valkey, Mailpit
```
- Postgres runs on `localhost:5432`, with user, password and database all set to `murmeli`.
- Valkey (Redis) runs on `localhost:6379`, with the password `devpassword`.
- Mailpit catches all outgoing email. Its SMTP server is on `localhost:1025`, and its web UI is at http://localhost:8025.

## Backend
```bash
cd backend
cp .env.example .env    # local development settings
npm ci
npm run start:dev       # http://localhost:3000/api
```

To try every level without playing through the trail, set `LEARNING_UNLOCK_ALL=true` in `backend/.env`. Every world and level is then open for every kid. The backend refuses to start with it when `NODE_ENV=production`.

## Frontend
```bash
cd frontend
npm ci
npm start               # http://localhost:4200, proxies /api to localhost:3000
```

## Checks
| What | Command |
|---|---|
| Repo scripts | `npm run scripts:test` |
| No ß in Swiss German | `npm run check:eszett` |
| Env vars documented | `npm run docs:check` |
| Backend | `npm run lint && npm run test:cov && npm run test:e2e` (in `backend/`) |
| Frontend | `npm run lint && npm run test:coverage && npm run e2e` (in `frontend/`) |
| Secret scan | gitleaks in CI. `.gitleaks.toml` skips `*.spec.ts` and `backend/test/`, so fake test keys belong there. |

## Releases
1. Every push to `main` updates the release pull request opened by release-please.
2. Merging that pull request tags `vX.Y.Z`.
3. The tag triggers multi-arch builds of `ghcr.io/samuelba/kids-learning/murmeli-{backend,frontend}`, which are pushed with the tags `vX.Y.Z`, `X.Y.Z` and `latest`.

`RELEASE_PLEASE_TOKEN` is optional. It's a fine-grained PAT that also makes CI run on the release pull request.

## Review process
Every feature goes through tests, then `/verify`, then an independent review by subagents (code, TypeScript, security, database and accessibility, depending on what changed), then fixes, then a commit. The details are in [docs/internal/plan.md](docs/internal/plan.md), §9a.

## Audio (offline TTS)
The read-aloud audio is generated once, offline, on a machine with an NVIDIA GPU (about 12 GB of models and around 25 minutes for the full set). The details are in [tools/audio/README.md](tools/audio/README.md).
```bash
cd tools/audio
./run.sh build        # build the GPU image (Qwen3-TTS, faster-whisper, ffmpeg)
./run.sh all          # extract → render → ASR verify → loudness/Opus → manifest → review.html
```
1. Listen to the flagged clips in `tools/audio/out/review.html`, then `approve` or `reroll` them.
2. Human recordings in `tools/audio/human/` always take precedence over generated clips.
3. Edit lexicon words in `content/lexicon/`. `tools/audio/lexicon` is only a fallback copy.
