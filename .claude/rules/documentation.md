# Keep documentation in sync with code

Every code change must update the documentation it affects, in the same change. A change isn't done while the related docs are stale.

- **User manual:** `docs/site/`. Update it when behavior, configuration, environment variables, defaults, ports, volumes, Docker images, authentication or the UI change.
- **Environment variables:** keep `.env.sample` and `docs/site/reference/configuration.md` consistent with the code. `npm run docs:check` checks this.
- **Developer docs:** `README.md`, `DEVELOPMENT.md` and `docs/internal/` when setup, architecture or workflows change.
- **Removals and renames:** when a feature, option or endpoint is removed or renamed, remove or rename it in the docs too.
- **Final check:** before finishing, search the docs for every name you changed (`grep -rn <name> docs/ README.md DEVELOPMENT.md .env.sample`) and fix any stale reference.
- **No docs change needed:** say so explicitly in the summary of the change.
