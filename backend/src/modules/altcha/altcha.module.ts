import { Module } from '@nestjs/common';
import { AltchaController } from './altcha.controller';
import { AltchaService } from './altcha.service';

@Module({
  controllers: [AltchaController],
  providers: [AltchaService],
  exports: [AltchaService],
})
export class AltchaModule {}
