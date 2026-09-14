import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { drainSyncQueue, runSync } from '@/services/sync';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { store } from '@/store/store';
import { transientFailuresRevived } from '@/store/sync/syncSlice';
import {
  selectNextAttemptAt,
  selectPendingCount,
} from '@/store/sync/syncSelectors';

export function useSync(): void {
  const dispatch = useAppDispatch();
  const isOnline = useAppSelector(state => state.connectivity.isOnline);
  const hasSession = useAppSelector(state => state.auth.hasSession);
  const pendingCount = useAppSelector(selectPendingCount);
  const nextAttemptAt = useAppSelector(selectNextAttemptAt);

  useEffect(() => {
    if (!hasSession || !isOnline) {
      return;
    }
    dispatch(transientFailuresRevived(Date.now()));
    runSync(store);
  }, [dispatch, hasSession, isOnline]);

  useEffect(() => {
    if (!hasSession || !isOnline || pendingCount === 0) {
      return;
    }
    drainSyncQueue(store);
  }, [hasSession, isOnline, pendingCount]);

  const previousState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      const wasAway = previousState.current !== 'active';
      previousState.current = next;
      if (wasAway && next === 'active') {
        runSync(store);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (nextAttemptAt === null || !isOnline || !hasSession) {
      return;
    }
    const delay = nextAttemptAt - Date.now();
    if (delay <= 0) {
      drainSyncQueue(store);
      return;
    }
    const timer = setTimeout(() => { drainSyncQueue(store); }, delay);
    return () => clearTimeout(timer);
  }, [hasSession, isOnline, nextAttemptAt]);
}
