import {
  envEmail,
  envPlainText,
  isHttpOrigin,
  normalizePlainText,
  parseBoolean,
  parseOriginList,
} from './env-parsers';

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

describe('envPlainText', () => {
  const schema = envPlainText(20);

  it('turns literal \\n into line breaks and trims every line', () => {
    expect(schema.parse('  Weg 1 \\n 8000 Bern  ')).toBe('Weg 1\n8000 Bern');
    expect(normalizePlainText('a\r\nb\rc')).toBe('a\nb\nc');
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it('rejects blank, too long and control characters', () => {
    expect(schema.safeParse('  ').success).toBe(false);
    expect(schema.safeParse('x'.repeat(21)).success).toBe(false);
    expect(schema.safeParse('a\u0007b').success).toBe(false);
    expect(schema.safeParse('a\tb').success).toBe(false);
  });
});

describe('envEmail', () => {
  it('accepts a trimmed address and rejects anything else', () => {
    expect(envEmail().parse(' privacy@example.com ')).toBe(
      'privacy@example.com',
    );
    expect(envEmail().safeParse('nope').success).toBe(false);
  });
});
