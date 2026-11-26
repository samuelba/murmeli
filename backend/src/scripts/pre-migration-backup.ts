import { runPreMigrationBackup } from '../backup/pre-migration-backup';

void runPreMigrationBackup(process.env).then((code) => {
  process.exitCode = code;
});
