import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TRANSLATIONS } from '../../../testing/i18n';
import { KNOWN_ERROR_CODES, errorMessage } from './error-message';

describe('errorMessage', () => {
  const api = (status: number, code: string | null, retryAfterSeconds: number | null = null) => ({
    status,
    code,
    message: 'x',
    retryAfterSeconds,
  });

  it.each(KNOWN_ERROR_CODES)('maps %s to a translated message in both languages', (code) => {
    const { key } = errorMessage(api(400, code));
    expect(key).toBe(`errors.${code}`);
    for (const language of ['de-CH', 'en-US'] as const) {
      expect((TRANSLATIONS[language].errors as Record<string, string>)[code]).toBeTruthy();
    }
  });

  it.each([
    [api(429, 'RATE_LIMITED', 30), 'errors.RATE_LIMITED_SECONDS', 30],
    [api(429, 'RATE_LIMITED', 90), 'errors.RATE_LIMITED_MINUTES', 2],
    [api(429, null, null), 'errors.RATE_LIMITED', undefined],
    [api(429, 'PIN_LOCKED', 45), 'errors.PIN_LOCKED_SECONDS', 45],
    [api(429, 'PIN_LOCKED', 900), 'errors.PIN_LOCKED_MINUTES', 15],
    [api(429, 'PIN_LOCKED', 0), 'errors.PIN_LOCKED', undefined],
  ])('shows the retry time for %j', (error, key, count) => {
    const message = errorMessage(error);
    expect(message.key).toBe(key);
    expect(message.params?.['count']).toBe(count);
  });

  it.each([
    [api(0, null), 'errors.NETWORK'],
    [api(503, 'INTERNAL_ERROR'), 'errors.SERVER'],
    [api(404, 'NOT_FOUND'), 'errors.GENERIC'],
    [new Error('boom'), 'errors.GENERIC'],
    [null, 'errors.GENERIC'],
  ])('falls back for %j', (error, key) => {
    expect(errorMessage(error).key).toBe(key);
  });

  it('understands raw HttpErrorResponses', () => {
    const error = new HttpErrorResponse({
      status: 429,
      error: { errorCode: 'RATE_LIMITED' },
      headers: new HttpHeaders({ 'Retry-After': '5' }),
    });
    expect(errorMessage(error)).toEqual({
      key: 'errors.RATE_LIMITED_SECONDS',
      params: { count: 5 },
    });
  });
});
