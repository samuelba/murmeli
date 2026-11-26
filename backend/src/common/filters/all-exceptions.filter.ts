import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RetryAfterException } from '../errors/api-exception';
import { errorMessage } from '../errors/error-message';
import { toErrorBody } from '../errors/error-body';

/**
 * Turns every exception into the API error format. 5xx errors are logged with
 * their stack; their details never reach clients in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: unknown }>();
    const response = http.getResponse<Response>();
    const requestId =
      typeof request.id === 'string' || typeof request.id === 'number'
        ? String(request.id)
        : undefined;

    const body = toErrorBody(exception, this.isProduction);
    if (body.statusCode >= 500) {
      this.logError(exception);
    }

    if (exception instanceof RetryAfterException) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil(exception.retryAfterSeconds))),
      );
    }
    response.status(body.statusCode).json({ ...body, requestId });
  }

  private logError(exception: unknown): void {
    const error =
      exception instanceof HttpException && exception.cause !== undefined
        ? exception.cause
        : exception;
    if (error instanceof Error) {
      this.logger.error(error.message, error.stack);
      return;
    }
    this.logger.error(errorMessage(error));
  }
}
