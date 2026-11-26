import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto, SetupDto, TotpVerifyDto } from './auth.dto';

async function errors(cls: new () => object, body: object): Promise<string[]> {
  const result = await validate(plainToInstance(cls, body));
  return result.map((error) => error.property);
}

describe('auth DTOs', () => {
  it('trims the email before validating it', async () => {
    const dto = plainToInstance(LoginDto, {
      email: '  parent@example.com ',
      password: 'x',
    });

    expect(dto.email).toBe('parent@example.com');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('keeps non-string emails for the validator to reject', async () => {
    await expect(
      errors(LoginDto, { email: 42, password: 'x' }),
    ).resolves.toEqual(['email']);
  });

  it('accepts an optional setup token', async () => {
    const base = {
      email: 'admin@example.com',
      password: 'long-enough-password',
      locale: 'de-CH',
    };

    await expect(errors(SetupDto, base)).resolves.toEqual([]);
    await expect(
      errors(SetupDto, { ...base, setupToken: 'token' }),
    ).resolves.toEqual([]);
    await expect(
      errors(SetupDto, { ...base, setupToken: '' }),
    ).resolves.toEqual(['setupToken']);
  });

  it.each([
    [{ code: '123456' }, []],
    [{ recoveryCode: 'ABCD-EFGH-JKLM' }, []],
    [{}, ['code']],
    [{ code: '12345' }, ['code']],
  ])('validates the TOTP step body %j', async (body, expected) => {
    await expect(errors(TotpVerifyDto, body)).resolves.toEqual(expected);
  });
});
