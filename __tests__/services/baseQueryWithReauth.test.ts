/**
 * The refresh path, which is the one piece of Step B that cannot be checked
 * by hand: the concurrency case needs two requests failing at the same moment,
 * and the rotation case needs a token that dies mid-flight.
 */
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

const mockRawBaseQuery = jest.fn();
const mockGetRefreshToken = jest.fn();
const mockSaveRefreshToken = jest.fn();
const mockClearRefreshToken = jest.fn();

jest.mock('@/services/api/baseQuery', () => ({
  rawBaseQuery: (...args: unknown[]) => mockRawBaseQuery(...args),
}));

jest.mock('@/security/tokenStore', () => ({
  getRefreshToken: () => mockGetRefreshToken(),
  saveRefreshToken: (token: string) => mockSaveRefreshToken(token),
  clearRefreshToken: () => mockClearRefreshToken(),
}));

import { API_ERROR_CODES } from '@/domain/api/errors';
import { baseQueryWithReauth } from '@/services/api/baseQueryWithReauth';
import { API_PATHS } from '@/services/api/apiConfig';
import { sessionExpired, tokensRefreshed } from '@/store/auth/authSlice';

const fail = (status: number, code: string): { error: FetchBaseQueryError } => ({
  error: { status, data: { error: { code, message: 'nope' } } } as FetchBaseQueryError,
});

const ok = (data: unknown) => ({ data });

const REFRESHED = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
};

let dispatch: jest.Mock;
const api = () => ({ dispatch, getState: () => ({}), endpoint: 'getProfile' }) as never;

/** Every call after the first N behaves as a success. */
const respond = (...responses: unknown[]) => {
  for (const response of responses) {
    mockRawBaseQuery.mockImplementationOnce(() => Promise.resolve(response));
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  dispatch = jest.fn();
  mockGetRefreshToken.mockResolvedValue('stored-refresh');
  mockSaveRefreshToken.mockResolvedValue(true);
  mockClearRefreshToken.mockResolvedValue(undefined);
});

/** Calls that went to the refresh endpoint, whatever else happened. */
const refreshCalls = () =>
  mockRawBaseQuery.mock.calls.filter(
    call => (call[0] as { url?: string }).url === API_PATHS.REFRESH,
  );

describe('a dead access token', () => {
  it('refreshes once and replays the original request', async () => {
    respond(fail(401, API_ERROR_CODES.NO_TOKEN), ok(REFRESHED), ok({ name: 'Demo' }));

    const result = await baseQueryWithReauth('/profile', api(), {});

    expect(refreshCalls()).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledWith(
      tokensRefreshed({ accessToken: 'new-access' }),
    );
    expect(result.data).toEqual({ name: 'Demo' });
  });

  it('treats INVALID_TOKEN the same way', async () => {
    respond(fail(401, API_ERROR_CODES.INVALID_TOKEN), ok(REFRESHED), ok({}));
    await baseQueryWithReauth('/profile', api(), {});
    expect(refreshCalls()).toHaveLength(1);
  });

  it('treats a bare 401 with no envelope as expiry', async () => {
    respond(
      { error: { status: 401, data: undefined } },
      ok(REFRESHED),
      ok({}),
    );
    await baseQueryWithReauth('/profile', api(), {});
    expect(refreshCalls()).toHaveLength(1);
  });

  it('stores the rotated refresh token before replaying', async () => {
    respond(fail(401, API_ERROR_CODES.NO_TOKEN), ok(REFRESHED), ok({}));
    await baseQueryWithReauth('/profile', api(), {});
    expect(mockSaveRefreshToken).toHaveBeenCalledWith('new-refresh');
  });

  it('replays only once — a second 401 is expiry, not a race', async () => {
    respond(
      fail(401, API_ERROR_CODES.NO_TOKEN),
      ok(REFRESHED),
      fail(401, API_ERROR_CODES.NO_TOKEN),
    );

    const result = await baseQueryWithReauth('/profile', api(), {});

    expect(refreshCalls()).toHaveLength(1);
    expect(result.error).toBeDefined();
  });
});

describe('401s that must NOT trigger a refresh', () => {
  it('leaves a wrong password alone', async () => {
    respond(fail(401, API_ERROR_CODES.INVALID_CREDENTIALS));

    const result = await baseQueryWithReauth(
      { url: API_PATHS.LOGIN, method: 'POST' },
      api(),
      {},
    );

    expect(refreshCalls()).toHaveLength(0);
    expect(mockGetRefreshToken).not.toHaveBeenCalled();
    expect(result.error).toBeDefined();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not refresh for a 401 from signup either', async () => {
    respond(fail(401, API_ERROR_CODES.INVALID_CREDENTIALS));
    await baseQueryWithReauth({ url: API_PATHS.SIGNUP, method: 'POST' }, api(), {});
    expect(refreshCalls()).toHaveLength(0);
  });

  it('ignores non-401 failures entirely', async () => {
    respond(fail(500, API_ERROR_CODES.INTERNAL_ERROR));
    await baseQueryWithReauth('/profile', api(), {});
    expect(refreshCalls()).toHaveLength(0);
  });
});

describe('single-flight — mandatory because the token rotates', () => {
  it('refreshes once for several requests failing together', async () => {
    // Three requests 401, then one refresh, then three replays.
    mockRawBaseQuery.mockImplementation((args: { url?: string }) => {
      if (args.url === API_PATHS.REFRESH) {
        return Promise.resolve(ok(REFRESHED));
      }
      const calls = mockRawBaseQuery.mock.calls.length;
      return Promise.resolve(
        calls <= 3 ? fail(401, API_ERROR_CODES.NO_TOKEN) : ok({ replayed: true }),
      );
    });

    const results = await Promise.all([
      baseQueryWithReauth({ url: '/a' }, api(), {}),
      baseQueryWithReauth({ url: '/b' }, api(), {}),
      baseQueryWithReauth({ url: '/c' }, api(), {}),
    ]);

    // Without the lock, the second and third would send an already-rotated
    // token and sign the user out of a live session.
    expect(refreshCalls()).toHaveLength(1);
    for (const result of results) {
      expect(result.data).toEqual({ replayed: true });
    }
  });
});

describe('when the session is really over', () => {
  it('says so plainly when the refresh token is rejected', async () => {
    respond(
      fail(401, API_ERROR_CODES.NO_TOKEN),
      fail(401, API_ERROR_CODES.INVALID_REFRESH_TOKEN),
    );

    await baseQueryWithReauth('/profile', api(), {});

    const expiry = dispatch.mock.calls.find(
      ([action]) => action.type === sessionExpired.type,
    );
    // The API is single-session, so this is the likeliest cause and the user
    // deserves to be told rather than left guessing.
    expect(expiry?.[0].payload).toMatch(/another device/i);
    expect(mockClearRefreshToken).toHaveBeenCalled();
  });

  it('does not call an endpoint that cannot succeed when nothing is stored', async () => {
    mockGetRefreshToken.mockResolvedValue(null);
    respond(fail(401, API_ERROR_CODES.NO_TOKEN));

    await baseQueryWithReauth('/profile', api(), {});

    expect(refreshCalls()).toHaveLength(0);
    expect(dispatch).toHaveBeenCalledWith(
      sessionExpired(expect.stringContaining('session') as unknown as string),
    );
  });

  it('keeps the session alive when only the keystore write fails', async () => {
    // A device with no usable keystore failed at sign-in too; ending the
    // session here would make the app unusable rather than merely forgetful.
    mockSaveRefreshToken.mockResolvedValue(false);
    respond(fail(401, API_ERROR_CODES.NO_TOKEN), ok(REFRESHED), ok({ fine: true }));

    const result = await baseQueryWithReauth('/profile', api(), {});

    expect(result.data).toEqual({ fine: true });
    expect(dispatch).toHaveBeenCalledWith(
      tokensRefreshed({ accessToken: 'new-access' }),
    );
    // The stored token is stale now, so the next cold start goes to Login
    // rather than making a refresh call that is guaranteed to fail.
    expect(mockClearRefreshToken).toHaveBeenCalled();
  });
});
