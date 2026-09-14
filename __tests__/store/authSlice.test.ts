import {
  authReducer,
  deepLinkConsumed,
  deepLinkStashed,
  initialAuthState,
  loggedOut,
  sessionExpired,
  sessionStarted,
} from '@/store/auth/authSlice';

const LINK = { url: 'healthtracker://checkin/123', stashedAt: 1_700_000_000_000 };

describe('authSlice', () => {
  it('starts a session without touching a stashed deep link', () => {
    const stashed = authReducer(initialAuthState, deepLinkStashed(LINK));
    const state = authReducer(
      stashed,
      sessionStarted({ userId: 'u1', email: 'u1@example.com' }),
    );

    expect(state.hasSession).toBe(true);
    expect(state.userId).toBe('u1');
    expect(state.pendingDeepLink).toEqual(LINK);
  });

  it('consumes a deep link', () => {
    const stashed = authReducer(initialAuthState, deepLinkStashed(LINK));
    expect(authReducer(stashed, deepLinkConsumed()).pendingDeepLink).toBeNull();
  });

  it('logging out clears the session and any stale deep link', () => {
    let state = authReducer(
      initialAuthState,
      sessionStarted({ userId: 'u1', email: 'u1@example.com', accessToken: 't' }),
    );
    state = authReducer(state, deepLinkStashed(LINK));

    const out = authReducer(state, loggedOut());

    expect(out).toEqual({ ...initialAuthState, sessionEpoch: out.sessionEpoch });
    expect(out.userId).toBeNull();
    expect(out.email).toBeNull();
    expect(out.hasSession).toBe(false);
    expect(out.pendingDeepLink).toBeNull();
  });
});

describe('sessionExpired vs loggedOut', () => {
  const signedIn = () =>
    authReducer(
      initialAuthState,
      sessionStarted({ userId: 'A', email: 'a@example.com', accessToken: 't' }),
    );

  it('keeps who the retained data belongs to when a session expires', () => {
    const state = authReducer(signedIn(), sessionExpired('Session ended'));

    expect(state.hasSession).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.expiredReason).toBe('Session ended');
    expect(state.userId).toBe('A');
    expect(state.email).toBe('a@example.com');
  });

  it('forgets the identity on a deliberate logout', () => {
    const state = authReducer(signedIn(), loggedOut());
    expect(state.userId).toBeNull();
  });

  it('changes the epoch on every session transition', () => {
    const started = signedIn();
    const expired = authReducer(started, sessionExpired('gone'));
    const restarted = authReducer(
      expired,
      sessionStarted({ userId: 'A', email: 'a@example.com' }),
    );
    const out = authReducer(restarted, loggedOut());

    const epochs = [
      initialAuthState.sessionEpoch,
      started.sessionEpoch,
      expired.sessionEpoch,
      restarted.sessionEpoch,
      out.sessionEpoch,
    ];
    expect(new Set(epochs).size).toBe(epochs.length);
    expect([...epochs].sort((a, b) => a - b)).toEqual(epochs);
  });
});
