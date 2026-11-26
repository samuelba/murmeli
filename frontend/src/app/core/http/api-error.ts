import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  readonly status: number;
  readonly code: string | null;
  readonly message: string;
  readonly retryAfterSeconds?: number | null;
  readonly details?: readonly FieldError[];
  readonly requestId?: string | null;
}

export interface FieldError {
  readonly field: string;
  readonly constraints: readonly string[];
  readonly messages: readonly string[];
}

function parseDetails(value: unknown): FieldError[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && typeof (item as FieldError).field === 'string',
    )
    .map((item) => ({
      field: item['field'] as string,
      constraints: Array.isArray(item['constraints']) ? item['constraints'].map(String) : [],
      messages: Array.isArray(item['messages']) ? item['messages'].map(String) : [],
    }));
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

export function toApiError(error: HttpErrorResponse): ApiError {
  const body: unknown = error.error;
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const code = typeof record['errorCode'] === 'string' ? record['errorCode'] : null;
  const message = typeof record['message'] === 'string' ? record['message'] : error.message;
  const retryAfterSeconds = parseRetryAfter(error.headers?.get('Retry-After') ?? null);
  const details = parseDetails(record['details']);
  const requestId = typeof record['requestId'] === 'string' ? record['requestId'] : null;
  return { status: error.status, code, message, retryAfterSeconds, details, requestId };
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApiError).status === 'number' &&
    typeof (value as ApiError).message === 'string'
  );
}

export function errorCodeOf(error: unknown): string | null {
  if (error instanceof HttpErrorResponse) {
    return toApiError(error).code;
  }
  return isApiError(error) ? error.code : null;
}
