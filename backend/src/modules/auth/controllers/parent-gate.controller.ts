import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthThrottle } from '../../../throttler/auth-throttle.decorator';
import type { AuthContext } from '../auth.types';
import { CurrentAuth } from '../decorators/auth.decorators';
import { PasswordDto } from '../dto/auth.dto';
import { ParentGateService } from '../services/parent-gate.service';

@Controller('auth/parent-gate')
export class ParentGateController {
  constructor(private readonly gate: ParentGateService) {}

  @AuthThrottle()
  @Post()
  @HttpCode(200)
  async unlock(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: PasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ parentGateExpiresAt: string }> {
    const expiresAt = await this.gate.unlock(auth, dto.password, response);
    return { parentGateExpiresAt: expiresAt.toISOString() };
  }

  @Post('lock')
  @HttpCode(204)
  lock(@Res({ passthrough: true }) response: Response): void {
    this.gate.lock(response);
  }
}
