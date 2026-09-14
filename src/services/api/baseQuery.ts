import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Platform } from 'react-native';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/env';
import type { RootState } from '@/store/rootReducer';

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
    headers.set('X-App-Platform', Platform.OS);

    if (UNAUTHENTICATED_ENDPOINTS.has(endpoint)) {
      return headers;
    }

    const token = (getState() as RootState).auth.accessToken;
    if (token !== null && token !== '') {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});
