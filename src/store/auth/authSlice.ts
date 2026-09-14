import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type PendingDeepLink = { url: string; stashedAt: number };

export type AuthState = {
  hasSession: boolean;
  userId: string | null;
  email: string | null;
  accessToken: string | null;
  pendingDeepLink: PendingDeepLink | null;
  expiredReason: string | null;
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
    },
    tokensRefreshed(state, action: PayloadAction<{ accessToken: string }>) {
      state.accessToken = action.payload.accessToken;
      state.expiredReason = null;
    },
    sessionExpired(state, action: PayloadAction<string>) {
      state.hasSession = false;
      state.accessToken = null;
      state.expiredReason = action.payload;
      state.sessionEpoch += 1;
    },
    expiryAcknowledged(state) {
      state.expiredReason = null;
    },
    loggedOut(state) {
      return { ...initialAuthState, sessionEpoch: state.sessionEpoch + 1 };
    },
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
