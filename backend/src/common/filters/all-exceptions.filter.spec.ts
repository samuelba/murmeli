import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { RetryAfterException } from '../errors/api-exception';
import { AllExceptionsFilter } from './all-exceptions.filter';

function hostFor(request: Record<string, unknown> = { id: 'req-1' }) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => errorSpy.mockRestore());

  it('writes the error body with the request id', () => {
    const { host, status, json } = hostFor();

    new AllExceptionsFilter(true).catch(new BadRequestException('Nope'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      errorCode: 'BAD_REQUEST',
      message: 'Nope',
      requestId: 'req-1',
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('accepts numeric request ids and omits missing ones', () => {
    const numeric = hostFor({ id: 7 });
    const missing = hostFor({});

    new AllExceptionsFilter(true).catch(
      new HttpException('x', 418),
      numeric.host,
    );
    new AllExceptionsFilter(true).catch(
      new HttpException('x', 418),
      missing.host,
    );

    expect(numeric.json.mock.calls[0][0].requestId).toBe('7');
    expect(missing.json.mock.calls[0][0].requestId).toBeUndefined();
  });

  it('logs unexpected errors with their stack', () => {
    const { host, status } = hostFor();
    const error = new Error('connection refused');

    new AllExceptionsFilter(true).catch(error, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(errorSpy).toHaveBeenCalledWith(error.message, error.stack);
  });

  it('logs the cause of a 5xx HTTP exception', () => {
    const { host } = hostFor();
    const cause = new Error('redis down');

    new AllExceptionsFilter(true).catch(
      new HttpException('Unavailable', 503, { cause }),
      host,
    );

    expect(errorSpy).toHaveBeenCalledWith('redis down', cause.stack);
  });

  it('logs thrown non-errors', () => {
    const { host } = hostFor();

    new AllExceptionsFilter(false).catch('plain string', host);

    expect(errorSpy).toHaveBeenCalledWith('plain string');
  });

  it('sets Retry-After for RetryAfterException', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const setHeader = jest.fn();
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'r' }),
        getResponse: () => ({ status, setHeader }),
      }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter(true).catch(
      new RetryAfterException(12.2, 'PIN_LOCKED', 'Locked'),
      host,
    );

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '13');
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'PIN_LOCKED' }),
    );
  });

  it('never sends a Retry-After below one second', () => {
    const setHeader = jest.fn();
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({
          status: () => ({ json: jest.fn() }),
          setHeader,
        }),
      }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter(true).catch(new RetryAfterException(0), host);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '1');
  });
});
