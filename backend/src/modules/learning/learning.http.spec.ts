import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AnswerDto, CurrentKid, LevelIdPipe } from './learning.http';

function decoratorFactory(decorator: () => ParameterDecorator) {
  class Probe {
    handler(@decorator() _value: unknown) {}
  }
  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Probe,
    'handler',
  ) as Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => unknown }
  >;
  return Object.values(args)[0].factory;
}

function context(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('CurrentKid', () => {
  const factory = decoratorFactory(CurrentKid);

  it('returns the kid that KidGuard attached', () => {
    const kid = { id: 'k1' };
    expect(factory(undefined, context({ kid }))).toBe(kid);
  });

  it('fails loudly without KidGuard', () => {
    expect(() => factory(undefined, context({}))).toThrow(/KidGuard/);
  });
});

describe('LevelIdPipe', () => {
  const pipe = new LevelIdPipe();

  it('accepts kebab-case level ids', () => {
    expect(pipe.transform('math-zahlenwiese-01')).toBe('math-zahlenwiese-01');
  });

  it.each(['', 'Math-01', 'a--b', '../etc', 'a'.repeat(101), 'a b'])(
    'rejects %p with VALIDATION_FAILED',
    (value) => {
      let error: unknown;
      try {
        pipe.transform(value);
      } catch (caught) {
        error = caught;
      }
      expect(error).toMatchObject({
        response: { errorCode: 'VALIDATION_FAILED' },
      });
    },
  );

  it('rejects non-strings', () => {
    expect(() => pipe.transform(3)).toThrow();
  });
});

describe('AnswerDto', () => {
  const errors = (body: object) =>
    validateSync(plainToInstance(AnswerDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }).map((error) => error.property);

  it('accepts an index and any answer object', () => {
    expect(errors({ index: 0, answer: { value: 3 } })).toEqual([]);
  });

  it('rejects bad indexes, a missing answer and extra fields', () => {
    expect(errors({ index: -1, answer: {} })).toEqual(['index']);
    expect(errors({ index: 50, answer: {} })).toEqual(['index']);
    expect(errors({ index: 1.5, answer: {} })).toEqual(['index']);
    expect(errors({ index: 0 })).toEqual(['answer']);
    expect(errors({ index: 0, answer: {}, extra: 1 })).toEqual(['extra']);
  });
});
