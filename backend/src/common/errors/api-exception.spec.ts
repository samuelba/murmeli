import { HttpStatus } from '@nestjs/common';
import { RetryAfterException, apiError } from './api-exception';

describe('apiError', () => {
  it('carries the error code and status', () => {
    const error = apiError(HttpStatus.FORBIDDEN, 'SETUP_COMPLETE', 'Done');

    expect(error.getStatus()).toBe(403);
    expect(error.getResponse()).toEqual({
      errorCode: 'SETUP_COMPLETE',
      message: 'Done',
    });
  });
});

describe('RetryAfterException', () => {
  it('defaults to 429 RATE_LIMITED', () => {
    const error = new RetryAfterException(30);

    expect(error.getStatus()).toBe(429);
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.getResponse()).toEqual({
      errorCode: 'RATE_LIMITED',
      message: 'Too many attempts',
    });
  });

  it('accepts a specific code', () => {
    const error = new RetryAfterException(60, 'PIN_LOCKED', 'Locked');

    expect(error.getResponse()).toMatchObject({ errorCode: 'PIN_LOCKED' });
  });
});
