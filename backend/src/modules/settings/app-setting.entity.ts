import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SettingSource } from './app-setting.keys';

@Entity('app_settings')
@Check('CHK_app_settings_source', `"source" IN ('env', 'admin')`)
export class AppSettingEntity {
  @PrimaryColumn({ type: 'text' })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ type: 'text', default: 'env' })
  source: SettingSource;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
