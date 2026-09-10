import {
  loginSchema,
  normalizeEmail,
  otpSchema,
  OTP_LENGTH,
} from '@/domain/auth/validation';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Asha.Menon@Gmail.COM ')).toBe('asha.menon@gmail.com');
  });
});

describe('loginSchema', () => {
  const valid = { email: 'asha.menon@gmail.com', password: 'loganberry24' };

  it('accepts a well-formed login', () => {
    const result = loginSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('normalizes the email on the way out', () => {
    const result = loginSchema.parse({ ...valid, email: '  ASHA@Gmail.com ' });
    expect(result.email).toBe('asha@gmail.com');
  });

  it.each([
    ['empty', ''],
    ['no at sign', 'asha.gmail.com'],
    ['no domain', 'asha@'],
    ['spaces only', '   '],
  ])('rejects an invalid email (%s)', (_label, email) => {
    expect(loginSchema.safeParse({ ...valid, email }).success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = loginSchema.safeParse({ ...valid, password: 'short12' });
    expect(result.success).toBe(false);
  });

  it('accepts a password of exactly 8 characters', () => {
    const result = loginSchema.safeParse({ ...valid, password: '12345678' });
    expect(result.success).toBe(true);
  });

  it('reports both fields when both are wrong', () => {
    const result = loginSchema.safeParse({ email: 'nope', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map(issue => issue.path[0]);
      expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
    }
  });
});

describe('otpSchema', () => {
  it('accepts exactly four digits', () => {
    expect(otpSchema.safeParse({ code: '1234' }).success).toBe(true);
    // Leading zeros are digits like any other — the code is a string, not a number.
    expect(otpSchema.safeParse({ code: '0000' }).success).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['too short', '12'],
    ['too long', '12345'],
    ['a letter among them', '12a4'],
    ['spaces', '12 4'],
    ['punctuation the number pad still offers', '1-24'],
  ])('rejects %s', (_label, code) => {
    expect(otpSchema.safeParse({ code }).success).toBe(false);
  });

  it('reports the length in the message, from the same constant as the boxes', () => {
    const result = otpSchema.safeParse({ code: '12' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(`Enter the ${OTP_LENGTH}-digit code`);
    }
  });
});
