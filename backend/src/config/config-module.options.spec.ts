import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { validRawEnv } from '../../test/fixtures/env';
import { CONFIG_MODULE_OPTIONS } from './config-module.options';

describe('CONFIG_MODULE_OPTIONS', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('exposes empty env values as unset instead of falling back to process.env', async () => {
    process.env = {
      ...saved,
      ...validRawEnv({ SETUP_TOKEN: '', COOKIE_DOMAIN: '' }),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ...CONFIG_MODULE_OPTIONS, ignoreEnvFile: true }),
      ],
    }).compile();
    const config = moduleRef.get(ConfigService);

    expect(config.get('SETUP_TOKEN')).toBeUndefined();
    expect(config.get('COOKIE_DOMAIN')).toBeUndefined();
    expect(config.get('PORT')).toBe(3000);
  });
});
