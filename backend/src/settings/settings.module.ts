import { Module } from '@nestjs/common';
import { AppSettingsBootstrap } from './app-settings.bootstrap';

@Module({
  providers: [AppSettingsBootstrap],
})
export class SettingsModule {}
