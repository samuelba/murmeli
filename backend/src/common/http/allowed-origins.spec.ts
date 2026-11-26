import { buildAllowedOrigins, isOriginAllowed } from './allowed-origins';

describe('buildAllowedOrigins', () => {
  it('always includes the origin of APP_URL', () => {
    expect(buildAllowedOrigins('https://murmeli.example.com/app', [])).toEqual([
      'https://murmeli.example.com',
    ]);
  });

  it('adds CORS_ORIGINS without duplicates', () => {
    expect(
      buildAllowedOrigins('https://murmeli.example.com', [
        'https://murmeli.example.com/',
        'http://localhost:4200',
      ]),
    ).toEqual(['https://murmeli.example.com', 'http://localhost:4200']);
  });
});

describe('isOriginAllowed', () => {
  const allowed = ['https://murmeli.example.com'];

  it('accepts a listed origin, ignoring a trailing slash', () => {
    expect(isOriginAllowed('https://murmeli.example.com/', allowed)).toBe(true);
  });

  it.each([
    'https://evil.example.com',
    'http://murmeli.example.com',
    'https://murmeli.example.com.evil.com',
    'null',
  ])('rejects %p', (origin) => {
    expect(isOriginAllowed(origin, allowed)).toBe(false);
  });
});
