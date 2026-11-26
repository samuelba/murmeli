import { HttpException, HttpStatus } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import { errorMessage } from './error-message';

export interface ErrorBody {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly message: string;
  readonly details?: readonly unknown[];
  readonly detail?: string;
}

const CODE_OVERRIDES: Readonly<Record<number, string>> = {
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

const BODY_PARSER_ERRORS: Readonly<Record<string, ErrorBody>> = {
  'entity.parse.failed': {
    statusCode: 400,
    errorCode: 'INVALID_JSON',
    message: 'The request body is not valid JSON',
  },
  'entity.too.large': {
    statusCode: 413,
    errorCode: 'PAYLOAD_TOO_LARGE',
    message: 'The request body is too large',
  },
};

export function defaultErrorCode(status: number): string {
  const name = (HttpStatus as Record<number, string | undefined>)[status];
  return (
    CODE_OVERRIDES[status] ??
    name ??
    (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR')
  );
}

function statusText(status: number): string {
  return STATUS_CODES[status] ?? 'Error';
}

function bodyParserError(exception: HttpException): ErrorBody | undefined {
  const cause = exception.cause as { type?: unknown } | undefined;
  return typeof cause?.type === 'string'
    ? BODY_PARSER_ERRORS[cause.type]
    : undefined;
}

function fromHttpException(exception: HttpException): ErrorBody {
  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  const fields =
    typeof response === 'string'
      ? { message: response }
      : (response as Record<string, unknown>);

  const message = Array.isArray(fields.message)
    ? fields.message.map(String).join('; ')
    : typeof fields.message === 'string'
      ? fields.message
      : statusText(statusCode);
  const errorCode =
    typeof fields.errorCode === 'string'
      ? fields.errorCode
      : defaultErrorCode(statusCode);
  const details = Array.isArray(fields.details) ? fields.details : undefined;

  return { statusCode, errorCode, message, ...(details && { details }) };
}

/**
 * Builds the API error body `{ statusCode, errorCode, message, details? }`.
 * In production every 5xx is reduced to its status, code and status text.
 */
export function toErrorBody(
  exception: unknown,
  isProduction: boolean,
): ErrorBody {
  const body =
    exception instanceof HttpException
      ? (bodyParserError(exception) ?? fromHttpException(exception))
      : {
          statusCode: 500,
          errorCode: defaultErrorCode(500),
          message: statusText(500),
          ...(!isProduction && { detail: errorMessage(exception) }),
        };

  if (isProduction && body.statusCode >= 500) {
    return {
      statusCode: body.statusCode,
      errorCode: body.errorCode,
      message: statusText(body.statusCode),
    };
  }
  return body;
}
