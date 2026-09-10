import { useCallback, useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import {
  decideDeepLink,
  isStashExpired,
  type DeepLinkContext,
  type DeepLinkDecision,
} from '@/navigation/deepLinks';
import { navigationRef } from '@/navigation/navigationRef';
import {
  selectHasSession,
  selectPendingDeepLink,
} from '@/store/auth/authSelectors';
import { deepLinkConsumed, deepLinkStashed } from '@/store/auth/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectProfileComplete } from '@/store/profile/profileSelectors';
import type { RootState } from '@/store/rootReducer';

/**
 * `Linking.getInitialURL()` keeps resolving the launch URL for the whole
 * process lifetime, so without this guard any remount of RootNavigator — a
 * Fast Refresh, say — would re-open the same link.
 */
let initialUrlHandled = false;

const selectCheckInsById = (state: RootState) => state.checkins.byId;

/**
 * Cold start and post-login replay both reset, because there is no stack
 * worth preserving and Back must reach the dashboard rather than drop out of
 * the app. A link arriving while someone is mid-task pushes instead, so Back
 * returns them to what they were doing.
 *
 * Returns false when it could not navigate, so the caller keeps the link
 * stashed and tries again. Silently losing a link the user tapped is the one
 * outcome worth guarding against here.
 */
function applyDecision(decision: DeepLinkDecision, fresh: boolean): boolean {
  if (!navigationRef.isReady()) {
    return false;
  }
  if (decision.action !== 'open' && decision.action !== 'notFound') {
    return true;
  }

  const route =
    decision.action === 'open'
      ? ({ name: 'CheckInDetail', params: { id: decision.target.id } } as const)
      : ({ name: 'CheckInNotFound', params: { id: decision.id } } as const);

  try {
    if (fresh) {
      navigationRef.reset({ index: 1, routes: [{ name: 'Tabs' }, route] });
    } else if (decision.action === 'open') {
      navigationRef.navigate('CheckInDetail', { id: decision.target.id });
    } else {
      navigationRef.navigate('CheckInNotFound', { id: decision.id });
    }
    return true;
  } catch {
    // The target navigator was not mounted yet. Keep the link and retry.
    return false;
  }
}

export function useDeepLinks(containerReady: boolean): void {
  const dispatch = useAppDispatch();
  const hasSession = useAppSelector(selectHasSession);
  const profileComplete = useAppSelector(selectProfileComplete);
  const pending = useAppSelector(selectPendingDeepLink);
  const checkInsById = useAppSelector(selectCheckInsById);
  /**
   * Offline counts as loaded: what is on the device is all there is, and
   * holding the link until a network appears would be worse than answering
   * from local data.
   */
  const checkInsLoaded = useAppSelector(
    state => state.checkins.fetchedAt !== null || !state.connectivity.isOnline,
  );

  /**
   * Held in a ref so the `url` listener is subscribed once and still sees
   * current state — re-subscribing on every auth change would risk dropping
   * an event in the gap.
   */
  const context = useRef<DeepLinkContext>({
    // Placeholder only: overwritten on this same first render, below.
    hasSession,
    profileComplete,
    checkInsLoaded: false,
    checkInExists: () => false,
  });
  context.current = {
    hasSession,
    profileComplete,
    checkInsLoaded,
    checkInExists: (id: string) => checkInsById[id] !== undefined,
  };

  const readyRef = useRef(containerReady);
  readyRef.current = containerReady;

  const stash = useCallback(
    (url: string) => {
      dispatch(deepLinkStashed({ url, stashedAt: Date.now() }));
    },
    [dispatch],
  );

  const handleUrl = useCallback(
    (url: string, source: 'initial' | 'event') => {
      const decision = decideDeepLink(url, context.current);

      if (decision.action === 'ignore') {
        // Never a check-in link. Making someone sign in only to be shown a
        // Not-found screen would be worse than doing nothing.
        return;
      }
      if (decision.action === 'stash') {
        stash(url);
        return;
      }
      // A launch URL, or one that beat the navigator to being mounted: park
      // it so the replay effect opens it against a fresh stack.
      if (source === 'initial' || !readyRef.current) {
        stash(url);
        return;
      }
      if (!applyDecision(decision, false)) {
        stash(url);
      }
    },
    [stash],
  );

  // Cold start.
  useEffect(() => {
    if (initialUrlHandled) {
      return;
    }
    initialUrlHandled = true;
    Linking.getInitialURL()
      .then(url => {
        if (url) {
          handleUrl(url, 'initial');
        }
      })
      .catch(() => {
        // A launcher can hand over a malformed intent; that is not a crash.
      });
  }, [handleUrl]);

  // While running.
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url, 'event');
    });
    return () => subscription.remove();
  }, [handleUrl]);

  // Replay: fires when the gate opens, which is after sign-in and after
  // onboarding finishes, and at cold start once the navigator is mounted.
  useEffect(() => {
    if (!containerReady || pending === null) {
      return;
    }
    if (!hasSession || !profileComplete) {
      // Still gated. Keep holding it rather than dropping it.
      return;
    }
    if (isStashExpired(pending.stashedAt, Date.now())) {
      dispatch(deepLinkConsumed());
      return;
    }

    const decision = decideDeepLink(pending.url, context.current);
    if (decision.action === 'stash') {
      // Still waiting on something — the check-in list, most likely. Holding
      // is the point; consuming here would drop the link entirely.
      return;
    }

    // Consumed only once it actually landed, so a navigator that was not yet
    // mounted costs a retry rather than the link.
    if (applyDecision(decision, true)) {
      dispatch(deepLinkConsumed());
    }
  }, [checkInsLoaded, containerReady, dispatch, hasSession, pending, profileComplete]);
}
