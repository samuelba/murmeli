import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export interface FieldError {
  readonly field: string;
  readonly constraints: readonly string[];
  readonly messages: readonly string[];
}

export function flattenValidationErrors(
  errors: readonly ValidationError[],
  parent = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints
      ? [
          {
            field,
            constraints: Object.keys(error.constraints),
            messages: Object.values(error.constraints),
          },
        ]
      : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    errorCode: 'VALIDATION_FAILED',
    message: 'Validation failed',
    details: flattenValidationErrors(errors),
  });
}
