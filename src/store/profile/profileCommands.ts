import { toProfilePatch, type ProfileDto } from '@/services/api/dto';
import type { AppDispatch } from '@/store/store';
import type { RootState } from '@/store/rootReducer';
import { profileHydrated, profileReset } from './profileSlice';

type Thunk<T = void> = (dispatch: AppDispatch, getState: () => RootState) => T;

export const applyAuthProfile =
  (profile: ProfileDto | null): Thunk =>
    (dispatch, getState) => {
      if (profile !== null) {
        dispatch(profileHydrated(toProfilePatch(profile)));
        return;
      }

      if (!getState().profile.pendingSync) {
        dispatch(profileReset());
      }
    };
