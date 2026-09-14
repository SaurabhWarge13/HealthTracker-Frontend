import { z } from 'zod';

const MIN_PASSWORD_LENGTH = 8;

export const OTP_LENGTH = 4;

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

export const otpSchema = z.object({
  code: z
    .string()
    .regex(
      new RegExp(`^\\d{${OTP_LENGTH}}$`),
      `Enter the ${OTP_LENGTH}-digit code`,
    ),
});

export type OtpValues = z.input<typeof otpSchema>;
