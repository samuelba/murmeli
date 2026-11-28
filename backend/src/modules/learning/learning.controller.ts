import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  AnswerResponse,
  FinishRunResponse,
  MapResponse,
  PracticeCatalogResponse,
  PracticeRunResponse,
  StartRunResponse,
} from '@murmeli/content';
import { UuidParam } from '../../common/http/uuid-param';
import type { KidEntity } from '../kids/kid.entity';
import { KidGuard } from '../kids/kid.guard';
import {
  AnswerDto,
  CurrentKid,
  LevelIdParam,
  StartPracticeDto,
} from './learning.http';
import { PracticeService } from './practice/practice.service';
import { ProgressService } from './progress/progress.service';
import { RunService } from './runs/run.service';

/**
 * The kid's learning API (contract §3). Every route needs an active kid
 * session (`mu_kid`), and a run is only visible to the kid who started it.
 */
@UseGuards(KidGuard)
@Controller('learn')
export class LearningController {
  constructor(
    private readonly progress: ProgressService,
    private readonly runs: RunService,
    private readonly practice: PracticeService,
  ) {}

  @Get('map')
  map(@CurrentKid() kid: KidEntity): Promise<MapResponse> {
    return this.progress.map(kid);
  }

  @Post('levels/:levelId/runs')
  @HttpCode(201)
  startLevel(
    @CurrentKid() kid: KidEntity,
    @LevelIdParam() levelId: string,
  ): Promise<StartRunResponse> {
    return this.runs.startLevel(kid, levelId);
  }

  @Get('practice')
  practiceCatalog(
    @CurrentKid() kid: KidEntity,
  ): Promise<PracticeCatalogResponse> {
    return this.practice.catalog(kid);
  }

  @Post('practice/runs')
  @HttpCode(201)
  startPractice(
    @CurrentKid() kid: KidEntity,
    @Body() dto: StartPracticeDto,
  ): Promise<PracticeRunResponse> {
    return this.runs.startPractice(kid, dto.topic ?? null);
  }

  @Post('runs/:runId/answers')
  @HttpCode(200)
  answer(
    @CurrentKid() kid: KidEntity,
    @UuidParam('runId') runId: string,
    @Body() dto: AnswerDto,
  ): Promise<AnswerResponse> {
    return this.runs.answer(kid, runId, dto.index, dto.answer);
  }

  @Post('runs/:runId/finish')
  @HttpCode(200)
  finish(
    @CurrentKid() kid: KidEntity,
    @UuidParam('runId') runId: string,
  ): Promise<FinishRunResponse> {
    return this.runs.finish(kid, runId);
  }
}
