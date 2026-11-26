import {
  BadRequestException,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { defaultErrorCode, toErrorBody } from './error-body';

describe('defaultErrorCode', () => {
  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_ERROR'],
    [503, 'SERVICE_UNAVAILABLE'],
    [599, 'INTERNAL_ERROR'],
    [499, 'ERROR'],
  ])('%i -> %s', (status, code) => {
    expect(defaultErrorCode(status)).toBe(code);
  });
});

describe('toErrorBody', () => {
  it('derives the code from the status', () => {
    expect(toErrorBody(new NotFoundException('No such kid'), true)).toEqual({
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'No such kid',
    });
  });

  it('keeps an explicit code and details', () => {
    const exception = new BadRequestException({
      errorCode: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: [{ field: 'name' }],
    });

    expect(toErrorBody(exception, true)).toEqual({
      statusCode: 400,
      errorCode: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: [{ field: 'name' }],
    });
  });

  it('joins message arrays and falls back to the status text', () => {
    expect(toErrorBody(new BadRequestException(['a', 'b']), true).message).toBe(
      'a; b',
    );
    expect(toErrorBody(new HttpException({ foo: 1 }, 409), true)).toEqual({
      statusCode: 409,
      errorCode: 'CONFLICT',
      message: 'Conflict',
    });
  });

  it('maps rate limiting to RATE_LIMITED', () => {
    expect(
      toErrorBody(new ThrottlerException('Too many requests'), true),
    ).toMatchObject({ statusCode: 429, errorCode: 'RATE_LIMITED' });
  });

  it.each([
    ['entity.parse.failed', 400, 'INVALID_JSON'],
    ['entity.too.large', 413, 'PAYLOAD_TOO_LARGE'],
  ])('maps body-parser %s to %i %s', (type, status, code) => {
    const exception = new HttpException('raw parser text', status, {
      cause: Object.assign(new Error('raw'), { type }),
    });

    expect(toErrorBody(exception, true)).toMatchObject({
      statusCode: status,
      errorCode: code,
    });
    expect(toErrorBody(exception, true).message).not.toContain('raw');
  });

  it('leaves other causes alone', () => {
    const exception = new PayloadTooLargeException('Too big', {
      cause: new Error('x'),
    });

    expect(toErrorBody(exception, true).message).toBe('Too big');
  });

  it('hides every 5xx body in production but keeps the code', () => {
    const exception = new ServiceUnavailableException({
      errorCode: 'RATE_LIMIT_UNAVAILABLE',
      message: 'redis at 10.0.0.3 refused',
      details: ['internal'],
    });

    expect(toErrorBody(exception, true)).toEqual({
      statusCode: 503,
      errorCode: 'RATE_LIMIT_UNAVAILABLE',
      message: 'Service Unavailable',
    });
  });

  it('shows 5xx messages outside production', () => {
    expect(
      toErrorBody(new ServiceUnavailableException('maintenance'), false)
        .message,
    ).toBe('maintenance');
  });

  it('turns unknown errors into INTERNAL_ERROR', () => {
    const error = new Error('db password is hunter2');

    expect(toErrorBody(error, true)).toEqual({
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
    });
    expect(toErrorBody(error, false)).toMatchObject({
      detail: 'db password is hunter2',
    });
  });
});
