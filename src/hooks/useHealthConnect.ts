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

  const connect = useCallback(() => run(dispatch, 'request'), [dispatch]);

  const refresh = useCallback(() => run(dispatch, 'refresh'), [dispatch]);

  return { status, syncing, connect, refresh, openSettings, openProviderInstall };
}
