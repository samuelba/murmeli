import { BadRequestException, Param, ParseUUIDPipe } from '@nestjs/common';

/**
 * A route parameter that must be a UUID; anything else is 400
 * VALIDATION_FAILED before it reaches a query.
 */
export const UuidParam = (name = 'id') =>
  Param(
    name,
    new ParseUUIDPipe({
      exceptionFactory: () =>
        new BadRequestException({
          errorCode: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: [
            {
              field: name,
              constraints: ['isUuid'],
              messages: [`${name} must be a UUID`],
            },
          ],
        }),
    }),
  );
