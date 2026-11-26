import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { UuidParam } from './uuid-param';

class Probe {
  handler(@UuidParam() _id: string, @UuidParam('kidId') _kidId: string): void {}
}

interface ArgMetadata {
  readonly data: string;
  readonly pipes: ParseUUIDPipe[];
}

function pipeFor(name: string): ParseUUIDPipe {
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Probe,
    'handler',
  ) as Record<string, ArgMetadata>;
  const arg = Object.values(metadata).find((entry) => entry.data === name);
  if (!arg) {
    throw new Error(`No parameter ${name}`);
  }
  return arg.pipes[0];
}

describe('UuidParam', () => {
  it('passes a UUID through', async () => {
    const id = '01a218d7-5edc-7a87-a1d4-5fe46ddc652d';

    await expect(
      pipeFor('id').transform(id, { type: 'param', data: 'id' }),
    ).resolves.toBe(id);
  });

  it.each([['id'], ['kidId']])(
    'answers anything else for %s with 400 VALIDATION_FAILED',
    async (name) => {
      const error = (await pipeFor(name)
        .transform('not-a-uuid', { type: 'param', data: name })
        .catch((e: unknown) => e)) as BadRequestException;

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toEqual({
        errorCode: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [
          {
            field: name,
            constraints: ['isUuid'],
            messages: [`${name} must be a UUID`],
          },
        ],
      });
    },
  );
});
