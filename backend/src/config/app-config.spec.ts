import type { AppConfigService } from './app-config';
import { pickEnv } from './app-config';

describe('pickEnv', () => {
  it('returns a frozen object with the requested keys', () => {
    const values: Record<string, unknown> = { PORT: 3000, NODE_ENV: 'test' };
    const config = {
      get: (key: string) => values[key],
    } as unknown as AppConfigService;

    const env = pickEnv(config, ['PORT']);

    expect(env).toEqual({ PORT: 3000 });
    expect(Object.isFrozen(env)).toBe(true);
  });
});
