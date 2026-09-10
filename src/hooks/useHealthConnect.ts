import { useCallback } from 'react';
import {
  ensureInitialized,
  getAvailability,
  getGrantedFields,
  HEALTH_CONNECT_FIELDS,
  logHealthConnect,
  logRead,
  mapTodayReadings,
  openProviderInstall,
  openSettings,
  readToday,
  requestPermissions,
} from '@/services/healthConnect';
import {
  healthConnectSyncFailed,
  healthConnectSynced,
  healthConnectSyncStarted,
  type HealthConnectField,
  type HealthConnectStatus,
} from '@/store/healthConnect/healthConnectSlice';
import {
  selectHealthConnectStatus,
  selectHealthConnectSyncing,
} from '@/store/healthConnect/healthConnectSelectors';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import type { AppDispatch } from '@/store/store';

/**
 * Module scope, not a ref: several screens mount this hook at once, and the
 * dashboard's Allow links would otherwise fire three overlapping reads.
 */
let inFlight: Promise<HealthConnectStatus> | null = null;

const statusFor = (granted: ReadonlyArray<HealthConnectField>): HealthConnectStatus => {
  if (granted.length === 0) {
    return 'NOT_CONNECTED';
  }
  return granted.length === HEALTH_CONNECT_FIELDS.length
    ? 'CONNECTED'
    : 'PARTIALLY_CONNECTED';
};

const DENIED_AVAILABILITY = {
  weight: 'PERMISSION_DENIED',
  height: 'PERMISSION_DENIED',
  steps: 'PERMISSION_DENIED',
  sleep: 'PERMISSION_DENIED',
  water: 'PERMISSION_DENIED',
} as const;

async function sync(
  dispatch: AppDispatch,
  mode: 'request' | 'refresh',
): Promise<HealthConnectStatus> {
  dispatch(healthConnectSyncStarted());

  const availability = await getAvailability();
  if (availability !== 'AVAILABLE') {
    /**
     * Pass the real reason through instead of flattening it. Every
     * non-AVAILABLE state stops here, but they are not equivalent to the user:
     * NOT_SUPPORTED hides every surface, while the three provider states keep
     * the card and offer a way out. Collapsing them all into NOT_SUPPORTED is
     * what left an Android 9-13 device without the provider installed showing
     * nothing at all.
     *
     * The SdkAvailability members are named to match HealthConnectStatus, so
     * this is a pass-through rather than a mapping.
     */
    logHealthConnect('not usable yet', availability);
    dispatch(
      healthConnectSynced({
        status: availability,
        availability: DENIED_AVAILABILITY,
      }),
    );
    return availability;
  }

  const ready = await ensureInitialized();
  if (!ready) {
    dispatch(healthConnectSyncFailed('Health Connect could not be initialised.'));
    return 'NOT_CONNECTED';
  }

  const granted =
    mode === 'request' ? await requestPermissions() : await getGrantedFields();
  logHealthConnect(`granted after ${mode}`, granted);

  const status = statusFor(granted);
  const now = Date.now();
  const raw = await readToday(granted, now);
  const mapped = mapTodayReadings(raw, now);
  logRead(raw, mapped);

  dispatch(
    healthConnectSynced({
      status,
      availability: mapped.availability,
      today: mapped.today,
    }),
  );
  return status;
}

function run(dispatch: AppDispatch, mode: 'request' | 'refresh') {
  if (inFlight !== null) {
    return inFlight;
  }
  inFlight = sync(dispatch, mode)
    .catch(error => {
      logHealthConnect('sync failed', error);
      dispatch(
        healthConnectSyncFailed(
          error instanceof Error ? error.message : 'Health Connect sync failed.',
        ),
      );
      return 'NOT_CONNECTED' as HealthConnectStatus;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function useHealthConnect() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectHealthConnectStatus);
  const syncing = useAppSelector(selectHealthConnectSyncing);

  /** Prompts for permission, then reads. For explicit user taps only. */
  const connect = useCallback(() => run(dispatch, 'request'), [dispatch]);

  /** Re-reads what we already hold. Never prompts. */
  const refresh = useCallback(() => run(dispatch, 'refresh'), [dispatch]);

  return { status, syncing, connect, refresh, openSettings, openProviderInstall };
}
