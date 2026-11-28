import { BadRequestException, HttpStatus } from '@nestjs/common';
import { DAILY_LIMIT_REACHED } from '@murmeli/content';
import { apiError } from '../../common/errors/api-exception';
import {
  ITEM_DONE,
  LEVEL_LOCKED,
  LEVEL_NOT_FOUND,
  NOTHING_TO_PRACTICE,
  RUN_BUSY,
  RUN_NOT_FOUND,
  TOPIC_LOCKED,
  TOPIC_NOT_FOUND,
} from './learning.constants';

export const levelNotFound = () =>
  apiError(HttpStatus.NOT_FOUND, LEVEL_NOT_FOUND, 'Level not found');

export const levelLocked = () =>
  apiError(HttpStatus.FORBIDDEN, LEVEL_LOCKED, 'This level is still locked');

export const runNotFound = () =>
  apiError(HttpStatus.NOT_FOUND, RUN_NOT_FOUND, 'Run not found');

export const itemDone = () =>
  apiError(HttpStatus.CONFLICT, ITEM_DONE, 'This item is already done');

export const runBusy = () =>
  apiError(HttpStatus.CONFLICT, RUN_BUSY, 'The run changed, try again');

export const nothingToPractice = () =>
  apiError(
    HttpStatus.CONFLICT,
    NOTHING_TO_PRACTICE,
    'There is nothing to practice yet',
  );

export const topicNotFound = () =>
  apiError(HttpStatus.NOT_FOUND, TOPIC_NOT_FOUND, 'Practice topic not found');

export const topicLocked = () =>
  apiError(
    HttpStatus.FORBIDDEN,
    TOPIC_LOCKED,
    'This practice topic is still locked',
  );

export const dailyLimitReached = () =>
  apiError(
    HttpStatus.FORBIDDEN,
    DAILY_LIMIT_REACHED,
    'The daily time limit is reached',
  );

export function invalidField(field: string, message: string) {
  return new BadRequestException({
    errorCode: 'VALIDATION_FAILED',
    message: 'Validation failed',
    details: [{ field, constraints: ['invalid'], messages: [message] }],
  });
}
