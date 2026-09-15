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

const offline = (): { error: FetchBaseQueryError } => ({
  error: { status: 'FETCH_ERROR', error: 'net down' } as FetchBaseQueryError,
});

const ok = (data: unknown) => ({ data });

const REFRESHED = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
};

let dispatch: jest.Mock;
const api = () => ({ dispatch, getState: () => ({}), endpoint: 'getProfile' }) as never;

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
    expect(expiry?.[0].payload).toMatch(/session ended/i);
    expect(mockClearRefreshToken).toHaveBeenCalled();
  });

  it('does not blame another device, since the code cannot tell us that', async () => {
    respond(
      fail(401, API_ERROR_CODES.NO_TOKEN),
      fail(401, API_ERROR_CODES.INVALID_REFRESH_TOKEN),
    );

    await baseQueryWithReauth('/profile', api(), {});

    const expiry = dispatch.mock.calls.find(
      ([action]) => action.type === sessionExpired.type,
    );
    expect(expiry?.[0].payload).not.toMatch(/another device/i);
  });

  it('drops a token the server rejected as malformed', async () => {
    respond(
      fail(401, API_ERROR_CODES.NO_TOKEN),
      fail(400, API_ERROR_CODES.VALIDATION_ERROR),
    );

    await baseQueryWithReauth('/profile', api(), {});

    expect(mockClearRefreshToken).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      sessionExpired(expect.stringContaining('session') as unknown as string),
    );
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

  it('keeps the token when the network drops mid-refresh', async () => {
    respond(fail(401, API_ERROR_CODES.NO_TOKEN), offline());

    const result = await baseQueryWithReauth('/profile', api(), {});

    expect(mockClearRefreshToken).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: sessionExpired.type }),
    );
    expect(result.error).toBeDefined();
  });

  it('keeps the token when the refresh endpoint itself is broken', async () => {
    respond(
      fail(401, API_ERROR_CODES.NO_TOKEN),
      fail(500, API_ERROR_CODES.INTERNAL_ERROR),
    );

    await baseQueryWithReauth('/profile', api(), {});

    expect(mockClearRefreshToken).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: sessionExpired.type }),
    );
  });

  it('retries the refresh on a later request once the network is back', async () => {
    respond(fail(401, API_ERROR_CODES.NO_TOKEN), offline());
    await baseQueryWithReauth('/profile', api(), {});

    respond(fail(401, API_ERROR_CODES.NO_TOKEN), ok(REFRESHED), ok({ back: true }));
    const result = await baseQueryWithReauth('/profile', api(), {});

    expect(result.data).toEqual({ back: true });
    expect(dispatch).toHaveBeenCalledWith(
      tokensRefreshed({ accessToken: 'new-access' }),
    );
  });

  it('keeps the session alive when only the keystore write fails', async () => {
    mockSaveRefreshToken.mockResolvedValue(false);
    respond(fail(401, API_ERROR_CODES.NO_TOKEN), ok(REFRESHED), ok({ fine: true }));

    const result = await baseQueryWithReauth('/profile', api(), {});

    expect(result.data).toEqual({ fine: true });
    expect(dispatch).toHaveBeenCalledWith(
      tokensRefreshed({ accessToken: 'new-access' }),
    );
    expect(mockClearRefreshToken).toHaveBeenCalled();
  });
});
