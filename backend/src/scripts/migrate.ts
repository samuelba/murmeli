import { runMigrations } from '../database/migrate';

void runMigrations(process.env).then((code) => {
  process.exitCode = code;
});
