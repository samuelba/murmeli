import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validRawEnv } from '../../test/fixtures/env';
import { baseEnvSchema } from './env.schema';
import { ENV_VARS, ENV_VAR_NAMES } from './env-vars';
import { validateEnv } from './validate-env';

const README = readFileSync(join(__dirname, 'README.md'), 'utf8');

function display(value: unknown): string {
  return Array.isArray(value) ? value.join(',') : String(value);
}

describe('ENV_VARS', () => {
  it('lists exactly the variables of the schema', () => {
    expect([...ENV_VAR_NAMES].sort()).toEqual(
      Object.keys(baseEnvSchema.shape).sort(),
    );
  });

  it('has no duplicates', () => {
    expect(new Set(ENV_VAR_NAMES).size).toBe(ENV_VAR_NAMES.length);
  });

  it('documents the defaults the schema applies', () => {
    const env = validateEnv(validRawEnv({ NODE_ENV: undefined }), {
      warn: jest.fn(),
    });

    for (const envVar of ENV_VARS.filter((v) => v.default !== undefined)) {
      expect([envVar.name, display(env[envVar.name])]).toEqual([
        envVar.name,
        envVar.default,
      ]);
    }
  });

  const rows = new Map(
    README.split('\n')
      .filter((line) => line.startsWith('| `'))
      .map((line) => line.split('|').map((cell) => cell.trim()))
      .map((cells) => [cells[1].replace(/`/g, ''), cells.slice(2, 4)]),
  );

  it.each(ENV_VARS.map((envVar) => [envVar.name, envVar]))(
    'documents %s in src/config/README.md',
    (name, envVar) => {
      const [required, defaultValue] = rows.get(name) ?? [];

      expect(required).toBe(envVar.required);
      expect(defaultValue).toBe(
        envVar.default === undefined
          ? ''
          : envVar.default === ''
            ? '(empty)'
            : `\`${envVar.default}\``,
      );
    },
  );

  it('documents nothing else', () => {
    expect([...rows.keys()].sort()).toEqual([...ENV_VAR_NAMES].sort());
  });
});
