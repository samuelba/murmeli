import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KidsModule } from '../kids/kids.module';
import { LearningModule } from '../learning/learning.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { MeController } from './me.controller';

@Module({
  imports: [AuthModule, KidsModule, LearningModule],
  controllers: [AccountController, MeController],
  providers: [AccountService],
})
export class AccountModule {}
