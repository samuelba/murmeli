import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminOverviewService } from './admin-overview.service';
import { AdminRecoveryService } from './admin-recovery.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController, AdminController],
  providers: [AdminUsersService, AdminOverviewService, AdminRecoveryService],
})
export class AdminModule {}
