import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingEntity } from './app-setting.entity';
import { AppSettingsBootstrap } from './app-settings.bootstrap';
import { SettingsService } from './settings.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AppSettingEntity])],
  providers: [AppSettingsBootstrap, SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
