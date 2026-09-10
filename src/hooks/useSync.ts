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

  /**
   * The engine is not a hook and holds its own single-flight guard, so firing
   * it more often than necessary is harmless — which is what makes these
   * triggers safe to overlap.
   *
   * Mount, and coming back online: revive, then push then pull.
   *
   * The revive comes first because being online is new information about every
   * op that gave up on a bad connection. Without it, a two-minute outage costs
   * the user a trip to Settings to press Retry on something that would now
   * succeed on its own.
   */
  useEffect(() => {
    if (!hasSession || !isOnline) {
      return;
    }
    dispatch(transientFailuresRevived(Date.now()));
    runSync(store);
  }, [dispatch, hasSession, isOnline]);

  /**
   * A new op: push only. Pulling here as well would refetch the whole list
   * every time the queue drains, since draining is itself what changes the
   * count — one wasted request per saved check-in.
   */
  useEffect(() => {
    if (!hasSession || !isOnline || pendingCount === 0) {
      return;
    }
    drainSyncQueue(store);
  }, [hasSession, isOnline, pendingCount]);

  // Foreground.
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

  // Scheduled retry.
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
