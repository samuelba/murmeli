import {
  type ExecutionContext,
  type PipeTransform,
  Param,
  createParamDecorator,
} from '@nestjs/common';
import { IsDefined, IsInt, Max, Min } from 'class-validator';
import type { KidEntity } from '../kids/kid.entity';
import type { KidRequest } from '../kids/kid.guard';
import { LEVEL_ID_PATTERN } from './content/curriculum';
import { invalidField } from './learning.errors';

export const MAX_ITEM_INDEX = 49;
const LEVEL_ID_MAX_LENGTH = 100;

export const CurrentKid = createParamDecorator(
  (_data: unknown, context: ExecutionContext): KidEntity => {
    const kid = context.switchToHttp().getRequest<KidRequest>().kid;
    if (!kid) {
      throw new Error('CurrentKid used without KidGuard');
    }
    return kid;
  },
);

export class LevelIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (
      typeof value !== 'string' ||
      value.length > LEVEL_ID_MAX_LENGTH ||
      !LEVEL_ID_PATTERN.test(value)
    ) {
      throw invalidField('levelId', 'levelId must be a level id');
    }
    return value;
  }
}

export const LevelIdParam = () => Param('levelId', new LevelIdPipe());

export class AnswerDto {
  @IsInt()
  @Min(0)
  @Max(MAX_ITEM_INDEX)
  index: number;

  @IsDefined()
  answer: unknown;
}
