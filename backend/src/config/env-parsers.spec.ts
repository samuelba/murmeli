import { isHttpOrigin, parseBoolean, parseOriginList } from './env-parsers';

describe('parseBoolean', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['YES', true],
    ['false', false],
    ['0', false],
    ['no', false],
  ])('parses %p', (raw, expected) => {
    expect(parseBoolean(raw, !expected)).toBe(expected);
  });

  it.each([undefined, '', ' '])('falls back for %p', (raw) => {
    expect(parseBoolean(raw, true)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(() => parseBoolean('on', false)).toThrow('"on" is not a boolean');
  });
});

describe('parseOriginList', () => {
  it('splits, trims and drops trailing slashes and empty entries', () => {
    expect(parseOriginList(' https://a.example.com/ ,, http://b:4200')).toEqual(
      ['https://a.example.com', 'http://b:4200'],
    );
  });
});

describe('isHttpOrigin', () => {
  it.each([
    ['https://a.example.com', true],
    ['http://localhost:4200', true],
    ['https://a.example.com/path', false],
    ['ftp://a.example.com', false],
    ['*', false],
    ['not a url', false],
  ])('%p -> %p', (value, expected) => {
    expect(isHttpOrigin(value)).toBe(expected);
  });
});
