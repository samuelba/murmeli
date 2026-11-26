import { errorMessage } from './error-message';

describe('errorMessage', () => {
  it.each([
    [new Error('boom'), 'boom'],
    ['plain', 'plain'],
    [{ code: 42 }, '{"code":42}'],
    [undefined, 'undefined'],
    [42, '42'],
  ])('describes %p', (error, expected) => {
    expect(errorMessage(error)).toBe(expected);
  });

  it('survives values that cannot be serialized', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(errorMessage(circular)).toBe('[object Object]');
  });
});
