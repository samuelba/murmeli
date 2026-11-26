# Backups and restore

All lasting data is in Postgres: accounts, kid profiles, progress, settings and the audit log. Valkey only holds short-lived data (rate-limit counters, lockouts, running exercise rounds, the email queue) and needs no backup. The curriculum, pictures and audio ship with the images.

What to back up:
1. **The database**, as a `pg_dump`.
2. **`.env`.** Without the same `ENCRYPTION_KEY`, two-factor sign-in stops working for everyone who uses it. The Postgres role names must also match when you restore. Keep `.env` somewhere safe and separate from the dumps, because it holds every secret.

## Automatic backups before migrations
Every time the backend starts, its entrypoint checks for pending database migrations. If there are any, it first writes a backup, then migrates, then starts the app. This protects you during [upgrades](upgrades.md). It is not a regular backup: a start without pending migrations writes no backup.

- **Location:** `/app/backups` in the backend container, on the named volume `murmeli_backups`. Docker Compose prefixes the volume with the project name, which is the folder name by default. Find the full name with `docker volume ls --filter name=murmeli_backups`.
- **Format:** `backup_<database>_<UTC timestamp>.sql.gz`, for example `backup_murmeli_2026-11-26T18-30-00-000Z.sql.gz`. It is a gzip-compressed plain SQL dump (`pg_dump --format=plain`), made by the owner role `POSTGRES_USER`. A dump is first written to a `.tmp` file and only renamed when `pg_dump` succeeded.
- **Permissions:** the directory has mode `0700`, each file `0600`, owned by the container's `node` user (UID 1000).
- **Retention:** at every start, Murmeli keeps at most `BACKUP_KEEP_COUNT` backups (default 10) and deletes those older than `BACKUP_MAX_AGE_DAYS` (default 30). The newest backup is always kept. Leftover `.tmp` files are removed.
- **Failure:** with `BACKUP_MANDATORY=true` (the default), a failed backup stops the start, and the database is not migrated. The backend log says `BACKUP_MANDATORY is on. Refusing to migrate.` and the container restarts until the cause is fixed. With `false`, it logs a warning and migrates anyway.
- `DB_MIGRATIONS_RUN=false` skips both the backup and the migrations.

### Copy the backups out
With `docker cp`, the copies belong to your user:

```bash
docker cp murmeli-backend:/app/backups ./murmeli-backups
```

Or stream the volume as a tar archive, which also works while the backend is stopped:

```bash
docker run --rm -v murmeli_murmeli_backups:/b:ro alpine tar -C /b -cf - . > murmeli-backups.tar
```

Replace `murmeli_murmeli_backups` with your volume name. Check that a file is complete with `gunzip -t <file>`.

## Regular backups
Run your own `pg_dump` on a schedule and copy the result off the server. Dumps made this way have the same format as the automatic ones, so the restore below works for both.

A script, for example `/usr/local/bin/murmeli-backup`:

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077

dir=/srv/murmeli-backups
file="$dir/murmeli-$(date -u +%Y-%m-%dT%H%M%SZ).sql.gz"
mkdir -p "$dir"

docker exec murmeli-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=plain' \
  | gzip > "$file.tmp"
mv "$file.tmp" "$file"

find "$dir" -name 'murmeli-*.sql.gz' -mtime +30 -delete
```

Make it executable (`chmod 700`) and run it every night, for example from root's crontab (`crontab -e`):

```cron
15 2 * * * /usr/local/bin/murmeli-backup
```

`pg_dump` runs inside the Postgres container as the owner role, so the dump includes every table, the ownership and the grants of the app role. `set -o pipefail` makes the script fail, and keep only the `.tmp` file, when `pg_dump` fails.

Then copy `/srv/murmeli-backups` to another machine or to storage off site, for example with restic, Borg or rsync. A backup that only lives on the same disk doesn't survive a disk failure.

Test a restore now and then, for example on a second machine.

## Restore
These steps replace the whole database with the content of a dump. Anything written after the dump was made is lost. They work for automatic backups and for your own dumps, on the same server or on a new one.

**Before you start:**
- `.env` must have the same `POSTGRES_USER` and `POSTGRES_APP_USER` as when the dump was made, because the dump assigns ownership and grants to these role names. Use the same `ENCRYPTION_KEY` as well.
- Use the Murmeli version that made the dump, or a newer one. A newer version migrates the restored database on its next start (after a new backup). To undo an upgrade, see [Upgrades](upgrades.md#roll-back).

**1. Stop the app, keep Postgres running.** On a new server, or after losing the database volume, `up -d postgres` creates a fresh database and the app role from `.env`.

```bash
docker compose stop frontend backend
docker compose up -d postgres
```

**2. Replace the database with an empty one.** This deletes all current data.

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE \"$POSTGRES_DB\" WITH (FORCE)" \
  -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\""'
```

Always start from a newly created database, even on a fresh volume. The init script on a fresh volume sets default grants that would otherwise widen the app role's rights on the audit log and the answer history during the restore. A newly created database has none, and the dump brings back the exact grants.

**3. Load the dump.**

```bash
gunzip -c backup_murmeli_2026-11-26T18-30-00-000Z.sql.gz \
  | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q'
```

`-T` lets the dump flow through standard input, and `ON_ERROR_STOP` stops at the first error. If it stops, fix the cause and start again at step 2. Use the `psql` inside the Postgres container: dumps from Postgres 18 contain `\restrict` lines that older `psql` versions don't understand.

**4. Start Murmeli.**

```bash
docker compose up -d
docker compose logs -f backend
```

The backend logs `Database schema is up to date.`, or migrates first if the image is newer than the dump. Sign in and check that the accounts and kid profiles are there.

Sessions stored in the dump are valid again, so devices that were signed in at the time of the dump may still be signed in.
