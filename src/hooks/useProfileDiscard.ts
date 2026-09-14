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

  return useCallback(async (): Promise<boolean> => {
    try {
      const profile = await fetchProfile().unwrap();
      dispatch(profileDiscarded());
      dispatch(profileHydrated(toProfilePatch(profile)));
      return true;
    } catch (error) {
      if (normalizeError(error).kind === 'notFound') {
        dispatch(profileDiscarded());
        dispatch(profileReset());
        return true;
      }
      return false;
    }
  }, [dispatch, fetchProfile]);
}
