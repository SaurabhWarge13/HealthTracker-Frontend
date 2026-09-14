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
    signup: builder.mutation<SignupResponseDto, Credentials>({
      query: body => ({ url: API_PATHS.SIGNUP, method: 'POST', body }),
    }),
    verifyOtp: builder.mutation<AuthResponseDto, VerifyOtpBody>({
      query: body => ({ url: API_PATHS.VERIFY_OTP, method: 'POST', body }),
    }),
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
