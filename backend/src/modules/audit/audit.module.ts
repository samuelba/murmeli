import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './audit-log.entity';
import { AuditService } from './audit.service';
import { RetentionService } from './retention.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditService, RetentionService],
  exports: [AuditService],
})
export class AuditModule {}
