import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { KidEntity } from './kid.entity';
import { KidGuard } from './kid.guard';
import { KidSessionService } from './kid-session.service';
import { KidsController } from './kids.controller';
import { KidsService } from './kids.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([KidEntity])],
  controllers: [KidsController],
  providers: [KidsService, KidSessionService, KidGuard],
  exports: [KidsService, KidSessionService, KidGuard],
})
export class KidsModule {}
