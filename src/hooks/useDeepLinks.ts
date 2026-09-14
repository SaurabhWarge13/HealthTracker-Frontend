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

let initialUrlHandled = false;

const selectCheckInsById = (state: RootState) => state.checkins.byId;

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
    return false;
  }
}

export function useDeepLinks(containerReady: boolean): void {
  const dispatch = useAppDispatch();
  const hasSession = useAppSelector(selectHasSession);
  const profileComplete = useAppSelector(selectProfileComplete);
  const pending = useAppSelector(selectPendingDeepLink);
  const checkInsById = useAppSelector(selectCheckInsById);
  const checkInsLoaded = useAppSelector(
    state => state.checkins.fetchedAt !== null || !state.connectivity.isOnline,
  );

  const context = useRef<DeepLinkContext>({
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
        return;
      }
      if (decision.action === 'stash') {
        stash(url);
        return;
      }
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
      .catch(() => {});
  }, [handleUrl]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url, 'event');
    });
    return () => subscription.remove();
  }, [handleUrl]);

  useEffect(() => {
    if (!containerReady || pending === null) {
      return;
    }
    if (!hasSession || !profileComplete) {
      return;
    }
    if (isStashExpired(pending.stashedAt, Date.now())) {
      dispatch(deepLinkConsumed());
      return;
    }

    const decision = decideDeepLink(pending.url, context.current);
    if (decision.action === 'stash') {
      return;
    }

    if (applyDecision(decision, true)) {
      dispatch(deepLinkConsumed());
    }
  }, [checkInsLoaded, containerReady, dispatch, hasSession, pending, profileComplete]);
}
