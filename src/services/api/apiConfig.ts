export const API_PATHS = {
  SIGNUP: '/auth/signup',
  VERIFY_OTP: '/auth/verify-otp',
  LOGIN: '/auth/login',
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',

  PROFILE: '/profile',

  CHECKINS: '/checkins',
  CHECKIN: (id: string) => `/checkins/${id}`,
} as const;

export const UNAUTHENTICATED_PATHS: readonly string[] = [
  API_PATHS.SIGNUP,
  API_PATHS.VERIFY_OTP,
  API_PATHS.LOGIN,
  API_PATHS.REFRESH,
];
