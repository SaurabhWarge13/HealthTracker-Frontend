import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import {
  API_ERROR_CODES,
  extractServerError,
  REFRESHABLE_CODES,
} from '@/domain/api/errors';
import {
  clearRefreshToken,
  getRefreshToken,
  saveRefreshToken,
} from '@/security/tokenStore';
import { sessionExpired, tokensRefreshed } from '@/store/auth/authSlice';
import { API_PATHS, UNAUTHENTICATED_PATHS } from './apiConfig';
import { rawBaseQuery } from './baseQuery';
import type { RefreshResponseDto } from './dto';

type Args = string | FetchArgs;
type QueryApi = Parameters<BaseQueryFn>[1];

const SIGNED_IN_ELSEWHERE =
  'You were signed out because your account was used on another device.';
const SESSION_ENDED = 'Your session ended. Sign in again — nothing on this device is lost.';

const urlOf = (args: Args): string => (typeof args === 'string' ? args : args.url);

function shouldAttemptRefresh(args: Args, error: FetchBaseQueryError): boolean {
  if (error.status !== 401) {
    return false;
  }
  if (UNAUTHENTICATED_PATHS.includes(urlOf(args))) {
    return false;
  }
  const code = extractServerError(error.data)?.code;
  return code === undefined || REFRESHABLE_CODES.includes(code);
}

type RefreshOutcome =
  | { ok: true; accessToken: string }
  | { ok: false; reason: string };

async function performRefresh(api: QueryApi): Promise<RefreshOutcome> {
  const refreshToken = await getRefreshToken();
  if (refreshToken === null) {
    return { ok: false, reason: SESSION_ENDED };
  }

  const result = await rawBaseQuery(
    {
      url: API_PATHS.REFRESH,
      method: 'POST',
      body: { refreshToken },
    },
    { ...api, endpoint: 'refresh' },
    {},
  );

  if (result.error !== undefined) {
    const code = extractServerError(result.error.data)?.code;
    await clearRefreshToken();
    return {
      ok: false,
      reason:
        code === API_ERROR_CODES.INVALID_REFRESH_TOKEN
          ? SIGNED_IN_ELSEWHERE
          : SESSION_ENDED,
    };
  }

  const data = result.data as RefreshResponseDto;

  const saved = await saveRefreshToken(data.refreshToken);
  if (!saved) {
    await clearRefreshToken();
  }

  api.dispatch(tokensRefreshed({ accessToken: data.accessToken }));
  return { ok: true, accessToken: data.accessToken };
}

let refreshInFlight: Promise<RefreshOutcome> | null = null;

function refreshOnce(api: QueryApi): Promise<RefreshOutcome> {
  refreshInFlight ??= performRefresh(api).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export const baseQueryWithReauth: BaseQueryFn<
  Args,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error === undefined || !shouldAttemptRefresh(args, result.error)) {
    return result;
  }

  const outcome = await refreshOnce(api);
  if (!outcome.ok) {
    api.dispatch(sessionExpired(outcome.reason));
    return result;
  }

  return rawBaseQuery(args, api, extraOptions);
};
