import { Platform } from 'react-native';
import type { Permission } from 'react-native-health-connect';
import { startOfLocalDay, WEIGHT_MAX_AGE_DAYS } from '@/domain/healthConnect/freshness';
import {
  availabilityFor,
  type ProviderAvailability,
  type SdkStatusKind,
} from '@/domain/healthConnect/provider';
import type { HealthConnectField } from '@/store/healthConnect/healthConnectSlice';
import type { RawTodayRecords } from './healthConnectMapper';
import {
  fieldsFromPermissions,
  READ_PERMISSIONS,
  RECORD_TYPE_BY_FIELD,
} from './permissions';

export type SdkAvailability = ProviderAvailability;

type TimeRangeFilter = {
  operator: 'between';
  startTime: string;
  endTime: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SLEEP_LOOKBACK_MS = 18 * 60 * 60 * 1000;

type HealthConnectModule = typeof import('react-native-health-connect');

let cachedModule: HealthConnectModule | null = null;

function nativeModule(): HealthConnectModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  if (cachedModule === null) {
    try {
      cachedModule = require('react-native-health-connect') as HealthConnectModule;
    } catch (error) {
      log('module failed to load', error);
      return null;
    }
  }
  return cachedModule;
}

export function log(label: string, payload?: unknown): void {
  if (!__DEV__) {
    return;
  }
  if (payload === undefined) {
    console.log(`[HealthConnect] ${label}`);
  } else {
    console.log(`[HealthConnect] ${label}`, payload);
  }
}

export function logRead(raw: RawTodayRecords, mapped: unknown): void {
  if (!__DEV__) {
    return;
  }
  console.log('[HealthConnect] raw records', {
    weight: raw.weight,
    height: raw.height,
    steps: raw.steps,
    sleep: raw.sleep,
    water: raw.water,
  });
  console.log('[HealthConnect] mapped readings', mapped);
}

export async function getAvailability(): Promise<SdkAvailability> {
  const hc = nativeModule();
  if (hc === null) {
    return 'NOT_SUPPORTED';
  }
  try {
    const status = await hc.getSdkStatus();
    log('sdk status', status);

    const kind: SdkStatusKind =
      status === hc.SdkAvailabilityStatus.SDK_AVAILABLE
        ? 'available'
        : status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
        ? 'updateRequired'
        : 'unavailable';

    const availability = availabilityFor(kind, Number(Platform.Version));
    log('provider availability', availability);
    return availability;
  } catch (error) {
    log('sdk status failed', error);
    return 'NOT_SUPPORTED';
  }
}

let initialized = false;

export async function ensureInitialized(): Promise<boolean> {
  const hc = nativeModule();
  if (hc === null) {
    return false;
  }
  if (initialized) {
    return true;
  }
  try {
    initialized = await hc.initialize();
    log('initialized', initialized);
    return initialized;
  } catch (error) {
    log('initialize failed', error);
    return false;
  }
}

export async function requestPermissions(): Promise<HealthConnectField[]> {
  const hc = nativeModule();
  if (hc === null) {
    return [];
  }
  try {
    const returned = await hc.requestPermission(READ_PERMISSIONS);
    log('permission request returned', returned);
  } catch (error) {
    log('permission request failed', error);
  }

  return getGrantedFields();
}

export async function getGrantedFields(): Promise<HealthConnectField[]> {
  const hc = nativeModule();
  if (hc === null) {
    return [];
  }
  try {
    const granted = await hc.getGrantedPermissions();
    log('granted permissions', granted);
    return fieldsFromPermissions(granted as Permission[]);
  } catch (error) {
    log('reading granted permissions failed', error);
    return [];
  }
}

export function openSettings(): void {
  const hc = nativeModule();
  if (hc === null) {
    return;
  }
  try {
    hc.openHealthConnectSettings();
  } catch (error) {
    log('opening settings failed', error);
  }
}

const between = (startTime: number, endTime: number): TimeRangeFilter => ({
  operator: 'between',
  startTime: new Date(startTime).toISOString(),
  endTime: new Date(endTime).toISOString(),
});

async function readField(
  field: HealthConnectField,
  range: TimeRangeFilter,
  granted: ReadonlyArray<HealthConnectField>,
): Promise<unknown[] | null> {
  if (!granted.includes(field)) {
    return null;
  }
  const hc = nativeModule();
  if (hc === null) {
    return null;
  }
  try {
    const result = await hc.readRecords(RECORD_TYPE_BY_FIELD[field], {
      timeRangeFilter: range,
    });
    return result.records;
  } catch (error) {
    log(`reading ${field} failed`, error);
    return null;
  }
}

export async function readToday(
  granted: ReadonlyArray<HealthConnectField>,
  now: number,
): Promise<RawTodayRecords> {
  const dayStart = startOfLocalDay(now);
  const today = between(dayStart, now);
  const sleepWindow = between(dayStart - SLEEP_LOOKBACK_MS, now);
  const slowWindow = between(now - WEIGHT_MAX_AGE_DAYS * DAY_MS, now);

  const [weight, height, steps, sleep, water] = await Promise.all([
    readField('weight', slowWindow, granted),
    readField('height', between(now - 365 * DAY_MS, now), granted),
    readField('steps', today, granted),
    readField('sleep', sleepWindow, granted),
    readField('water', today, granted),
  ]);

  return {
    weight: weight as RawTodayRecords['weight'],
    height: height as RawTodayRecords['height'],
    steps: steps as RawTodayRecords['steps'],
    sleep: sleep as RawTodayRecords['sleep'],
    water: water as RawTodayRecords['water'],
  };
}
