import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Platform } from 'react-native';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/env';
import type { RootState } from '@/store/rootReducer';

/**
 * The endpoint names that must go out without an Authorization header.
 *
 * `refresh` is not a real RTK Query endpoint — the reauth wrapper calls this
 * base query directly with the name overridden — but it is checked here so
 * that a rotated-away access token can never ride along on the one request
 * that has to work without it.
 */
const UNAUTHENTICATED_ENDPOINTS = new Set([
  'login',
  'signup',
  'verifyOtp',
  'refresh',
]);

export const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  prepareHeaders: (headers, { getState, endpoint }) => {
    headers.set('Accept', 'application/json');
    // Useful server-side for reading logs; harmless if ignored.
    headers.set('X-App-Platform', Platform.OS);

    if (UNAUTHENTICATED_ENDPOINTS.has(endpoint)) {
      return headers;
    }

    /**
     * On a cold start the session is restored from MMKV but the access token
     * is not — it is memory-only by contract. Rather than send `Bearer null`,
     * the header is omitted, the server answers NO_TOKEN, and the reauth
     * wrapper refreshes and replays. One path, no special boot sequence.
     */
    const token = (getState() as RootState).auth.accessToken;
    if (token !== null && token !== '') {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});
