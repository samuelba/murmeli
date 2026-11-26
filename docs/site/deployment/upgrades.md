# Upgrades

Releases follow semantic versioning and are listed with their changes on the project's GitHub releases page. Each release publishes both images with three tags: `vX.Y.Z`, `X.Y.Z` and `latest`.

## Pick a version
`MURMELI_VERSION` in `.env` selects the image tag for the backend and the frontend:

```dotenv
MURMELI_VERSION=0.3.0
```

The default is `latest`. Pinning a version is safer: you decide when to upgrade, and you know which version to go back to.

## Upgrade
1. Read the release notes of every version between yours and the new one.
2. Make a fresh backup and copy it off the server (see [Backups](backups.md#regular-backups)).
3. Compare your `docker-compose.yml` and `.env` with the ones in the new release. New variables usually have defaults, but the compose file may change too.
4. Set the new `MURMELI_VERSION` in `.env` (skip this with `latest`), then:

   ```bash
   docker compose pull
   docker compose up -d
   docker compose logs -f backend
   ```

When the backend starts, its entrypoint:
1. checks for pending migrations and, if there are any, writes a backup to the `murmeli_backups` volume (see [automatic backups](backups.md#automatic-backups-before-migrations)),
2. runs the migrations as the owner role, all in one transaction,
3. starts the app as the least-privileged role.

If the backup fails and `BACKUP_MANDATORY=true`, nothing is migrated and the backend doesn't start. If a migration fails, its transaction is rolled back, the database stays as it was, and the backend doesn't start. Either way, `docker compose logs backend` says why. The frontend waits until the backend is healthy.

The log lines to expect are `Pending migrations detected. Creating backup...`, `Backup created: ...` and `Applied migrations: ...`, or `No pending migrations. Skipping backup.` and `Database schema is up to date.`

## Roll back
Murmeli has no command that undoes migrations. To go back to the previous version:

- **The new version had no migrations** (the log said `Database schema is up to date.`): set `MURMELI_VERSION` back to the old version and run `docker compose up -d`.
- **The new version migrated the database:** the old version can't use the new schema. Restore the backup that was written just before the migration, then start the old version:
  1. Find the newest file in the backup volume (`docker cp murmeli-backend:/app/backups ./murmeli-backups`). Its name holds the UTC time of the upgrade.
  2. Set `MURMELI_VERSION` to the old version.
  3. [Restore](backups.md#restore) that file, then start with `docker compose up -d`.

  Everything that happened after the upgrade (new progress, new accounts) is lost.

## Postgres major versions
`docker-compose.yml` pins Postgres to major version 18 (`postgres:18-alpine`). `docker compose pull` brings minor updates of that version, which need nothing else. A new major version can't open the old data directory. To move to one, make a dump, change the image, start with a new, empty database volume, and [restore](backups.md#restore) the dump.
