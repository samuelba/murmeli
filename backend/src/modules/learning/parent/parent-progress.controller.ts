import { Controller, Get } from '@nestjs/common';
import { UuidParam } from '../../../common/http/uuid-param';
import type { AuthContext } from '../../auth/auth.types';
import {
  CurrentAuth,
  RequireParentGate,
} from '../../auth/decorators/auth.decorators';
import { ParentProgressService } from './parent-progress.service';
import type { ParentProgressResponse } from './parent-progress.types';

@Controller('parent/kids')
export class ParentProgressController {
  constructor(private readonly progress: ParentProgressService) {}

  @RequireParentGate()
  @Get(':id/progress')
  forKid(
    @CurrentAuth() auth: AuthContext,
    @UuidParam() id: string,
  ): Promise<ParentProgressResponse> {
    return this.progress.forKid(auth.userId, id);
  }
}
