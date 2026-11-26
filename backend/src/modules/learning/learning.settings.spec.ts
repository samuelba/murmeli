import { LearningSettings } from './learning.settings';

describe('LearningSettings', () => {
  it('builds the time zone and per-kid policies from the env', () => {
    const env: Record<string, unknown> = {
      APP_TIMEZONE: 'Europe/Zurich',
      RATE_LIMIT_LEARN_WINDOW_SECONDS: 60,
      RATE_LIMIT_LEARN_ANSWER_LIMIT: 60,
      RATE_LIMIT_LEARN_RUN_LIMIT: 20,
    };
    const settings = new LearningSettings({
      get: (key: string) => env[key],
    } as never);

    expect(settings.timeZone).toBe('Europe/Zurich');
    expect(settings.answers).toEqual({
      name: 'learn-answer',
      limit: 60,
      windowSeconds: 60,
      lockSeconds: 60,
    });
    expect(settings.runs).toMatchObject({ name: 'learn-run', limit: 20 });
  });
});
