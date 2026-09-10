import { useCallback } from 'react';
import { normalizeError } from '@/domain/api/errors';
import { useLazyGetProfileQuery } from '@/services/api';
import { toProfilePatch } from '@/services/api/dto';
import { useAppDispatch } from '@/store/hooks';
import {
  profileDiscarded,
  profileHydrated,
  profileReset,
} from '@/store/profile/profileSlice';

export function useProfileDiscard() {
  const dispatch = useAppDispatch();
  const [fetchProfile] = useLazyGetProfileQuery();

  /** True when the local profile now matches the server. */
  return useCallback(async (): Promise<boolean> => {
    try {
      const profile = await fetchProfile().unwrap();
      /**
       * Order is load-bearing: `profileHydrated` refuses to overwrite while
       * `pendingSync` is true, so the flags have to fall first or the fetched
       * values would be dropped on the floor.
       */
      dispatch(profileDiscarded());
      dispatch(profileHydrated(toProfilePatch(profile)));
      return true;
    } catch (error) {
      if (normalizeError(error).kind === 'notFound') {
        // The account has no server profile, so "the server's version" is
        // nothing — which onboarding will ask for again.
        dispatch(profileDiscarded());
        dispatch(profileReset());
        return true;
      }
      // Offline, or the server is unreachable. The edit stays, and so does
      // the failure the user is trying to resolve.
      return false;
    }
  }, [dispatch, fetchProfile]);
}
