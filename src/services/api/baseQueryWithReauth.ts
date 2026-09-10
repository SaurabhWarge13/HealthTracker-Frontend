/**
 * Token recovery.
 *
 * The API returns five different 401s and they want three different answers:
 * `NO_TOKEN`/`INVALID_TOKEN` mean refresh and retry, `INVALID_CREDENTIALS`
 * means the user mistyped their password, and `INVALID_REFRESH_TOKEN` means
 * the session is over. A wrapper that keys on the status alone — the common
 * shape — fires a token refresh every time someone gets their password wrong.
 *
 * The refresh token also **rotates**: the one sent is dead the moment the call
 * returns. That makes the single-flight lock below a correctness requirement
 * rather than an optimisation, because a second concurrent refresh would send
 * a token the first one already invalidated, get INVALID_REFRESH_TOKEN back,
 * and sign the user out of a perfectly good session.
 */
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

/**
 * Two guards, deliberately. The path check stops a wrong password from
 * triggering a refresh even if the server ever changed its code, and the code
 * check stops any other endpoint's non-expiry 401 from doing the same.
 */
function shouldAttemptRefresh(args: Args, error: FetchBaseQueryError): boolean {
  if (error.status !== 401) {
    return false;
  }
  if (UNAUTHENTICATED_PATHS.includes(urlOf(args))) {
    return false;
  }
  const code = extractServerError(error.data)?.code;
  // A bare 401 with no envelope is treated as expiry — the benign reading.
  return code === undefined || REFRESHABLE_CODES.includes(code);
}

type RefreshOutcome =
  | { ok: true; accessToken: string }
  | { ok: false; reason: string };

/** Only ever one of these in flight; see `refreshInFlight` below. */
async function performRefresh(api: QueryApi): Promise<RefreshOutcome> {
  const refreshToken = await getRefreshToken();
  if (refreshToken === null) {
    // Nothing to refresh with. Calling anyway would just be a slower failure.
    return { ok: false, reason: SESSION_ENDED };
  }

  const result = await rawBaseQuery(
    {
      url: API_PATHS.REFRESH,
      method: 'POST',
      body: { refreshToken },
    },
    // Overriding the endpoint name is what keeps a stale access token off the
    // one request that has to succeed without it (see baseQuery).
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

  /**
   * Persist the rotated token before anything else uses the session. If the
   * keystore write fails we do NOT end the session — a device where the
   * keystore is unavailable would then be unusable, and it failed at sign-in
   * too, so the user is no worse off than they already were. The stored token
   * is stale now, so it is cleared: the next cold start goes straight to
   * Login instead of making a refresh call that cannot succeed.
   */
  const saved = await saveRefreshToken(data.refreshToken);
  if (!saved) {
    await clearRefreshToken();
  }

  api.dispatch(tokensRefreshed({ accessToken: data.accessToken }));
  return { ok: true, accessToken: data.accessToken };
}

/**
 * Module scope on purpose: the lock has to span every request in the app, not
 * just the ones sharing a hook instance.
 */
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

  // Replayed exactly once. A second 401 now means the session really is over,
  // not that two requests raced — and retrying further would loop.
  return rawBaseQuery(args, api, extraOptions);
};
