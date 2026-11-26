import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  buildDataSourceOptions,
  withMigrationCredentials,
} from './database/data-source.options';
import { loadDatabaseEnv } from './database/database-env';

export default new DataSource(
  buildDataSourceOptions(withMigrationCredentials(loadDatabaseEnv())),
);
