import { z } from 'zod';

const MIN_PASSWORD_LENGTH = 8;

/** Digits in a verification code. The server's regex must agree with this. */
export const OTP_LENGTH = 4;

/** Emails are compared and sent lowercased and trimmed. */
export const normalizeEmail = (value: string): string =>
  value.trim().toLowerCase();

export const loginSchema = z.object({
  email: z
    .string()
    .transform(normalizeEmail)
    .pipe(z.string().min(1, 'Enter your email address').email('That email address looks wrong')),
  password: z
    .string()
    .min(1, 'Enter your password')
    .min(
      MIN_PASSWORD_LENGTH,
      `Passwords are at least ${MIN_PASSWORD_LENGTH} characters`,
    ),
});

export type LoginValues = z.input<typeof loginSchema>;

/**
 * The name belongs to onboarding, not here. The mismatch error is reported on
 * `confirmPassword` so it appears under the field the user has to fix.
 */
export const signupSchema = z
  .object({
    email: z
      .string()
      .transform(normalizeEmail)
      .pipe(
        z
          .string()
          .min(1, 'Enter your email address')
          .email('That email address looks wrong'),
      ),
    password: z
      .string()
      .min(1, 'Choose a password')
      .min(
        MIN_PASSWORD_LENGTH,
        `Passwords are at least ${MIN_PASSWORD_LENGTH} characters`,
      ),
    confirmPassword: z.string().min(1, 'Re-enter your password'),
  })
  .refine(values => values.password === values.confirmPassword, {
    message: "Those passwords don't match",
    path: ['confirmPassword'],
  });

export type SignupValues = z.input<typeof signupSchema>;

// `OtpInput` already strips non-digits as they are typed; this is what stops
// a short code being sent on a stray submit.
export const otpSchema = z.object({
  code: z
    .string()
    .regex(
      new RegExp(`^\\d{${OTP_LENGTH}}$`),
      `Enter the ${OTP_LENGTH}-digit code`,
    ),
});

export type OtpValues = z.input<typeof otpSchema>;
