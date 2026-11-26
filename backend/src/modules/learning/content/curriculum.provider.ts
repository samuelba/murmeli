import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AppConfigService, pickEnv } from '../../../config/app-config';
import { Curriculum, loadCurriculum } from './curriculum';

export const CurriculumProvider: Provider = {
  provide: Curriculum,
  inject: [ConfigService],
  useFactory: (config: AppConfigService) =>
    loadCurriculum(pickEnv(config, ['CONTENT_DIR']).CONTENT_DIR),
};
