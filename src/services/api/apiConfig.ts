export const API_PATHS = {
  SIGNUP: '/auth/signup',
  VERIFY_OTP: '/auth/verify-otp',
  LOGIN: '/auth/login',
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',

  PROFILE: '/profile',

  /** Note: no hyphen. */
  CHECKINS: '/checkins',
  CHECKIN: (id: string) => `/checkins/${id}`,
} as const;

/**
 * Requests that must never carry an access token and must never trigger a
 * token refresh when they 401 — a wrong password is an answer, not an expired
 * session (see baseQueryWithReauth).
 */
export const UNAUTHENTICATED_PATHS: readonly string[] = [
  API_PATHS.SIGNUP,
  API_PATHS.VERIFY_OTP,
  API_PATHS.LOGIN,
  API_PATHS.REFRESH,
];
