import { Secret } from 'otpauth';
import {
  TOTP_PERIOD_SECONDS,
  createTotpSecret,
  currentStep,
  generateCode,
  matchingStep,
  otpauthUrl,
} from './totp-codes';

const NOW = Date.UTC(2026, 10, 26, 12, 0, 0);

describe('totp codes', () => {
  it('creates 160-bit base32 secrets', () => {
    const secret = createTotpSecret();

    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(Secret.fromBase32(secret).bytes).toHaveLength(20);
    expect(createTotpSecret()).not.toBe(secret);
  });

  it('builds an otpauth URL with brand issuer and account label', () => {
    const url = otpauthUrl('JBSWY3DPEHPK3PXP', 'parent@example.com');

    expect(url).toMatch(/^otpauth:\/\/totp\//);
    expect(url).toContain('issuer=Murmeli');
    expect(url).toContain('parent%40example.com');
    expect(url).toContain('period=30');
    expect(url).toContain('digits=6');
  });

  it('computes the 30-second time step', () => {
    expect(currentStep(NOW)).toBe(Math.floor(NOW / 1000 / TOTP_PERIOD_SECONDS));
  });

  it('defaults to the current time', () => {
    const secret = createTotpSecret();

    expect(matchingStep(secret, generateCode(secret))).toBe(currentStep());
  });

  it('matches the current code to the current step', () => {
    const secret = createTotpSecret();

    expect(matchingStep(secret, generateCode(secret, NOW), NOW)).toBe(
      currentStep(NOW),
    );
  });

  it('accepts the neighbouring steps and reports which one matched', () => {
    const secret = createTotpSecret();
    const previous = generateCode(secret, NOW - TOTP_PERIOD_SECONDS * 1000);
    const next = generateCode(secret, NOW + TOTP_PERIOD_SECONDS * 1000);

    expect(matchingStep(secret, previous, NOW)).toBe(currentStep(NOW) - 1);
    expect(matchingStep(secret, next, NOW)).toBe(currentStep(NOW) + 1);
  });

  it('rejects codes outside the window and malformed codes', () => {
    const secret = createTotpSecret();
    const old = generateCode(secret, NOW - 5 * TOTP_PERIOD_SECONDS * 1000);

    expect(matchingStep(secret, old, NOW)).toBeNull();
    expect(matchingStep(secret, '12345', NOW)).toBeNull();
    expect(matchingStep(secret, 'abcdef', NOW)).toBeNull();
  });
});
