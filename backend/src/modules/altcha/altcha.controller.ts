import { Controller, Get } from '@nestjs/common';
import type { Challenge } from 'altcha-lib';
import { Public } from '../../common/decorators/public.decorator';
import { AltchaService } from './altcha.service';

@Controller('auth/altcha')
export class AltchaController {
  constructor(private readonly altcha: AltchaService) {}

  @Public()
  @Get()
  challenge(): Promise<Challenge> {
    return this.altcha.createChallenge();
  }
}
