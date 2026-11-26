import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UserGuardrail } from './user-guardrail.service';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UsersService, UserGuardrail],
  exports: [UsersService, UserGuardrail, TypeOrmModule],
})
export class UsersModule {}
