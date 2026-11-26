import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  readonly status: number;
  readonly code: string | null;
  readonly message: string;
}

export function toApiError(error: HttpErrorResponse): ApiError {
  const body: unknown = error.error;
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const code = typeof record['errorCode'] === 'string' ? record['errorCode'] : null;
  const message = typeof record['message'] === 'string' ? record['message'] : error.message;
  return { status: error.status, code, message };
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApiError).status === 'number' &&
    typeof (value as ApiError).message === 'string'
  );
}
