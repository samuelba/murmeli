import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { KidsModule } from '../kids/kids.module';
import { CurriculumProvider } from './content/curriculum.provider';
import { AttemptEntity } from './entities/attempt.entity';
import { DailyActivityEntity } from './entities/daily-activity.entity';
import { KidBadgeEntity } from './entities/kid-badge.entity';
import { LevelProgressEntity } from './entities/level-progress.entity';
import { PracticeDailyEntity } from './entities/practice-daily.entity';
import { PracticeReviewEntity } from './entities/practice-review.entity';
import { PracticeTopicProgressEntity } from './entities/practice-topic-progress.entity';
import { SkillMasteryEntity } from './entities/skill-mastery.entity';
import { LearningController } from './learning.controller';
import { LearningSettings } from './learning.settings';
import { ParentProgressController } from './parent/parent-progress.controller';
import { ParentProgressService } from './parent/parent-progress.service';
import { PracticeRecorder } from './practice/practice-recorder';
import { PracticeService } from './practice/practice.service';
import { PracticeStore } from './practice/practice.store';
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
      PracticeTopicProgressEntity,
      PracticeDailyEntity,
      PracticeReviewEntity,
    ]),
  ],
  controllers: [LearningController, ParentProgressController],
  providers: [
    CurriculumProvider,
    LearningSettings,
    ProgressStore,
    PracticeStore,
    PracticeRecorder,
    ProgressService,
    PracticeService,
    RunStore,
    RunService,
    ParentProgressService,
    ProgressExportService,
  ],
  exports: [ProgressExportService],
})
export class LearningModule {}
