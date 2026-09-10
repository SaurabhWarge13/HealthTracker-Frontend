import { API_PATHS } from './apiConfig';
import { baseApi } from './baseApi';
import type { AuthResponseDto, SignupResponseDto, VerifyOtpBody } from './dto';

export type Credentials = { email: string; password: string };

export const authApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: builder => ({
    login: builder.mutation<AuthResponseDto, Credentials>({
      query: body => ({ url: API_PATHS.LOGIN, method: 'POST', body }),
    }),
    // Creates nothing: reserves the email and parks the credentials until
    // `verifyOtp` proves the address, so no unverified account ever exists.
    signup: builder.mutation<SignupResponseDto, Credentials>({
      query: body => ({ url: API_PATHS.SIGNUP, method: 'POST', body }),
    }),
    /** The account is created here, which is why this returns the tokens. */
    verifyOtp: builder.mutation<AuthResponseDto, VerifyOtpBody>({
      query: body => ({ url: API_PATHS.VERIFY_OTP, method: 'POST', body }),
    }),
    // Best-effort: clears the server's refresh hash, but the client signs out
    // either way — a network problem must never trap someone in the app.
    logout: builder.mutation<void, void>({
      query: () => ({ url: API_PATHS.LOGOUT, method: 'POST' }),
    }),
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useVerifyOtpMutation,
  useLogoutMutation,
} = authApi;
