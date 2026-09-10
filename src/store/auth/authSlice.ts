import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** `stashedAt` is what lets a link tapped last week go stale before replay. */
export type PendingDeepLink = { url: string; stashedAt: number };

export type AuthState = {
  /** Enough for RootNavigator to pick a stack on frame one. */
  hasSession: boolean;
  userId: string | null;
  email: string | null;
  /** Memory only — never persisted. Refresh token lives in Keychain. */
  accessToken: string | null;
  /** Deep link that arrived while logged out; replayed after login. */
  pendingDeepLink: PendingDeepLink | null;
  /**
   * Why the session ended without the user asking — a dead refresh token, or
   * the account being used on another device. Distinct from a deliberate
   * logout: an expired session keeps the user's check-ins on the device,
   * because they did not ask to throw anything away.
   */
  expiredReason: string | null;
  /**
   * Bumped on every session transition. The sync engine captures this when it
   * starts and re-checks it after each await, so a request belonging to a
   * finished session cannot dispatch its result into a live one.
   *
   * `hasSession` cannot do this job: user A logs out, user B logs in, A's
   * response finally lands, and `hasSession` is `true` again — the check
   * passes and A's data is written into B's account.
   */
  sessionEpoch: number;
};

export const initialAuthState: AuthState = {
  hasSession: false,
  userId: null,
  email: null,
  accessToken: null,
  pendingDeepLink: null,
  expiredReason: null,
  sessionEpoch: 0,
};

type SessionPayload = {
  userId: string;
  email: string;
  accessToken?: string;
};

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    sessionStarted(state, action: PayloadAction<SessionPayload>) {
      state.hasSession = true;
      state.userId = action.payload.userId;
      state.email = action.payload.email;
      state.accessToken = action.payload.accessToken ?? null;
      state.expiredReason = null;
      state.sessionEpoch += 1;
      // pendingDeepLink deliberately preserved — it is replayed post-login.
    },
    /** A new access token from a refresh. The session itself is unchanged. */
    tokensRefreshed(state, action: PayloadAction<{ accessToken: string }>) {
      state.accessToken = action.payload.accessToken;
      state.expiredReason = null;
    },
    /**
     * The session ended on its own. Unlike `loggedOut`, this keeps whatever is
     * on the device: the user did not ask to discard anything, and signing
     * back in should find their work where they left it.
     */
    sessionExpired(state, action: PayloadAction<string>) {
      state.hasSession = false;
      state.accessToken = null;
      state.expiredReason = action.payload;
      state.sessionEpoch += 1;
      // `userId` and `email` are deliberately kept: the preserved data has to
      // record whose it is, and `useSignIn` compares against `userId` to tell
      // whether the next sign-in is the same person. Nulling it here is how
      // one account's check-ins became visible to the next. Nothing reads a
      // non-null `userId` as "signed in" — RootNavigator reads `hasSession`.
      // The pending deep link survives too, and replays after signing in.
    },
    /** Dismisses the "you were signed out" notice on the Login screen. */
    expiryAcknowledged(state) {
      state.expiredReason = null;
    },
    /**
     * The account boundary. Every account-scoped slice resets on this action
     * rather than being cleared by the caller — see the `extraReducers` in
     * checkins, profile, onboarding, sync, settings and healthConnect. One
     * action, no call site that can forget a slice.
     *
     * The epoch carries forward rather than resetting to 0: it is the fence
     * that tells a request from the session just ended apart from one
     * belonging to the session that follows.
     */
    loggedOut(state) {
      return { ...initialAuthState, sessionEpoch: state.sessionEpoch + 1 };
    },
    /** Only one link is held: a newer one replaces whatever was waiting. */
    deepLinkStashed(state, action: PayloadAction<PendingDeepLink>) {
      state.pendingDeepLink = action.payload;
    },
    deepLinkConsumed(state) {
      state.pendingDeepLink = null;
    },
  },
});

export const {
  sessionStarted,
  tokensRefreshed,
  sessionExpired,
  expiryAcknowledged,
  loggedOut,
  deepLinkStashed,
  deepLinkConsumed,
} = authSlice.actions;

export const authReducer = authSlice.reducer;
