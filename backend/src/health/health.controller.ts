import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AUTH_THROTTLER } from '../throttler/auth-throttle.decorator';
import { HealthService, type ReadinessReport } from './health.service';

@Public()
@SkipThrottle({ default: true, [AUTH_THROTTLER]: true })
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness(
    @Res({ passthrough: true }) res: Pick<Response, 'status'>,
  ): Promise<ReadinessReport> {
    const report = await this.health.readiness();
    if (report.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}
