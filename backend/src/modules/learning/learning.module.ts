import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { KidsModule } from '../kids/kids.module';
import { CurriculumProvider } from './content/curriculum.provider';
import { AttemptEntity } from './entities/attempt.entity';
import { DailyActivityEntity } from './entities/daily-activity.entity';
import { KidBadgeEntity } from './entities/kid-badge.entity';
import { LevelProgressEntity } from './entities/level-progress.entity';
import { SkillMasteryEntity } from './entities/skill-mastery.entity';
import { LearningController } from './learning.controller';
import { LearningSettings } from './learning.settings';
import { ParentProgressController } from './parent/parent-progress.controller';
import { ParentProgressService } from './parent/parent-progress.service';
import { ProgressExportService } from './progress/progress-export.service';
import { ProgressService } from './progress/progress.service';
import { ProgressStore } from './progress/progress.store';
import { RunService } from './runs/run.service';
import { RunStore } from './runs/run-store';

@Module({
  imports: [
    AuthModule,
    KidsModule,
    TypeOrmModule.forFeature([
      LevelProgressEntity,
      SkillMasteryEntity,
      AttemptEntity,
      DailyActivityEntity,
      KidBadgeEntity,
    ]),
  ],
  controllers: [LearningController, ParentProgressController],
  providers: [
    CurriculumProvider,
    LearningSettings,
    ProgressStore,
    ProgressService,
    RunStore,
    RunService,
    ParentProgressService,
    ProgressExportService,
  ],
  exports: [ProgressExportService],
})
export class LearningModule {}
