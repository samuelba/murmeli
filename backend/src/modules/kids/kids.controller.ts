import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { requestMeta } from '../../common/http/request-meta';
import { UuidParam } from '../../common/http/uuid-param';
import type { AuthContext } from '../auth/auth.types';
import {
  CurrentAuth,
  RequireParentGate,
} from '../auth/decorators/auth.decorators';
import { ActivateKidDto, CreateKidDto, UpdateKidDto } from './kid.dto';
import type { KidView } from './kid.types';
import { KidSessionService } from './kid-session.service';
import { KidsService } from './kids.service';

@Controller('kids')
export class KidsController {
  constructor(
    private readonly kids: KidsService,
    private readonly kidSessions: KidSessionService,
  ) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<KidView[]> {
    return this.kids.list(auth.userId);
  }

  @RequireParentGate()
  @Post()
  @HttpCode(201)
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateKidDto,
    @Req() request: Request,
  ): Promise<KidView> {
    return this.kids.create(
      { userId: auth.userId, ip: requestMeta(request).ip },
      dto,
    );
  }

  @Post('deactivate')
  @HttpCode(204)
  deactivate(@Res({ passthrough: true }) response: Response): void {
    this.kidSessions.deactivate(response);
  }

  @RequireParentGate()
  @Patch(':id')
  update(
    @CurrentAuth() auth: AuthContext,
    @UuidParam() id: string,
    @Body() dto: UpdateKidDto,
  ): Promise<KidView> {
    return this.kids.update(auth.userId, id, dto);
  }

  @RequireParentGate()
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentAuth() auth: AuthContext,
    @UuidParam() id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.kids.remove(
      { userId: auth.userId, ip: requestMeta(request).ip },
      id,
    );
  }

  @Post(':id/activate')
  @HttpCode(200)
  activate(
    @CurrentAuth() auth: AuthContext,
    @UuidParam() id: string,
    @Body() dto: ActivateKidDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<KidView> {
    return this.kidSessions.activate(
      auth,
      id,
      dto.pin,
      response,
      requestMeta(request).ip,
    );
  }
}
