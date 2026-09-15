import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { extractServerError, REFRESHABLE_CODES } from '@/domain/api/errors';
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

const SESSION_ENDED = 'Your session ended. Sign in again — nothing on this device is lost.';

/**
 * A 4xx means the server looked at the token and repudiated it, so it is worth
 * discarding. `INVALID_REFRESH_TOKEN` alone says nothing about *why* — expiry,
 * logout, a deleted user, rotation and a sign-in on another device all arrive
 * under that one code — so the copy stays generic. Anything else (offline,
 * timeout, 5xx) never reached that verdict; the token may still be good.
 */
const wasRepudiated = (error: FetchBaseQueryError): boolean =>
  typeof error.status === 'number' && error.status >= 400 && error.status < 500;

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
  | { ok: false; ended: true; reason: string }
  | { ok: false; ended: false };

async function performRefresh(api: QueryApi): Promise<RefreshOutcome> {
  const refreshToken = await getRefreshToken();
  if (refreshToken === null) {
    return { ok: false, ended: true, reason: SESSION_ENDED };
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
    if (!wasRepudiated(result.error)) {
      return { ok: false, ended: false };
    }
    await clearRefreshToken();
    return { ok: false, ended: true, reason: SESSION_ENDED };
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
    // A transient failure leaves the session standing: the caller sees the
    // original 401 and the next request tries the refresh again.
    if (outcome.ended) {
      api.dispatch(sessionExpired(outcome.reason));
    }
    return result;
  }

  return rawBaseQuery(args, api, extraOptions);
};
