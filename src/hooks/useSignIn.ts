import { useCallback, useState } from 'react';
import { normalizeError, type ApiError } from '@/domain/api/errors';
import { saveRefreshToken } from '@/security/tokenStore';
import {
  useLazyGetProfileQuery,
  useLoginMutation,
  useSignupMutation,
  useVerifyOtpMutation,
  type AuthResponseDto,
  type Credentials,
  type VerifyOtpBody,
} from '@/services/api';
import { toProfilePatch } from '@/services/api/dto';
import { sessionStarted, tokensRefreshed } from '@/store/auth/authSlice';
import { checkInsCleared } from '@/store/checkins/checkinsSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { draftCleared } from '@/store/onboarding/onboardingSlice';
import { profileHydrated, profileReset } from '@/store/profile/profileSlice';
import { syncCleared } from '@/store/sync/syncSlice';

export type SignInResult = { ok: true } | { ok: false; error: ApiError };

export function useSignIn() {
  const dispatch = useAppDispatch();
  const previousUserId = useAppSelector(state => state.auth.userId);
  const [login] = useLoginMutation();
  const [signup] = useSignupMutation();
  const [verify] = useVerifyOtpMutation();
  const [fetchProfile] = useLazyGetProfileQuery();
  const [submitting, setSubmitting] = useState(false);

  // A 404 is an answer, not a failure: no profile yet means onboarding is
  // correct. Any other failure leaves what is on the device alone.
  const hydrateProfile = useCallback(async (): Promise<void> => {
    try {
      const profile = await fetchProfile().unwrap();
      dispatch(profileHydrated(toProfilePatch(profile)));
    } catch (error) {
      if (normalizeError(error).kind === 'notFound') {
        dispatch(profileReset());
      }
    }
  }, [dispatch, fetchProfile]);

  /**
   * Turns a token pair into a live session. The ordering is deliberate — see
   * docs/AUTH_FLOW.md §4. Reached from both signing in and verifying a code.
   */
  const establishSession = useCallback(
    async (auth: AuthResponseDto): Promise<void> => {
      // Best effort: a device whose keystore is unavailable still gets a
      // working session, it just will not survive a restart.
      await saveRefreshToken(auth.refreshToken);

      // A different account must not inherit the last one's data — least of
      // all its outbox, which would post one user's check-ins into another's.
      // An expired session keeps everything; a different user starts clean.
      if (previousUserId !== null && previousUserId !== auth.user.id) {
        dispatch(checkInsCleared());
        dispatch(profileReset());
        dispatch(draftCleared());
        dispatch(syncCleared());
      }

      // Token in place, session not yet started: the calling screen stays up.
      dispatch(tokensRefreshed({ accessToken: auth.accessToken }));

      await hydrateProfile();

      dispatch(
        sessionStarted({
          userId: auth.user.id,
          email: auth.user.email,
          accessToken: auth.accessToken,
        }),
      );
    },
    [dispatch, hydrateProfile, previousUserId],
  );

  /**
   * The shared shell every auth action runs inside: one `submitting` flag and
   * a Result rather than a throw, so every screen handles failure the same way.
   */
  const attempt = useCallback(
    async (action: () => Promise<void>): Promise<SignInResult> => {
      setSubmitting(true);
      try {
        await action();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: normalizeError(error) };
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const signIn = useCallback(
    (credentials: Credentials) =>
      attempt(async () => {
        await establishSession(await login(credentials).unwrap());
      }),
    [attempt, establishSession, login],
  );

  // Starts no session: signup creates no account, so `establishSession` runs
  // in VerifyOtp instead.
  const signUp = useCallback(
    (credentials: Credentials) =>
      attempt(async () => {
        await signup(credentials).unwrap();
      }),
    [attempt, signup],
  );

  const verifyOtp = useCallback(
    (body: VerifyOtpBody) =>
      attempt(async () => {
        await establishSession(await verify(body).unwrap());
      }),
    [attempt, establishSession, verify],
  );

  return { signIn, signUp, verifyOtp, submitting };
}
