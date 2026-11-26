import type { ConfigModuleOptions } from '@nestjs/config';
import { validateEnv } from './validate-env';

export const CONFIG_MODULE_OPTIONS: ConfigModuleOptions = {
  isGlobal: true,
  cache: true,
  skipProcessEnv: true,
  validate: validateEnv,
};
