import { HttpException, HttpStatus } from '@nestjs/common';

export function apiError(
  status: HttpStatus,
  errorCode: string,
  message: string,
): HttpException {
  return new HttpException({ errorCode, message }, status);
}

/**
 * A 429 (or similar) whose `Retry-After` header the exception filter sets.
 */
export class RetryAfterException extends HttpException {
  constructor(
    readonly retryAfterSeconds: number,
    errorCode = 'RATE_LIMITED',
    message = 'Too many attempts',
    status: HttpStatus = HttpStatus.TOO_MANY_REQUESTS,
  ) {
    super({ errorCode, message }, status);
  }
}
