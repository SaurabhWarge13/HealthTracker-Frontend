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

/**
 * Kept as an alias so call sites read the same as before. The five-way split
 * and the reasoning behind it live in domain/healthConnect/provider.
 */
export type SdkAvailability = ProviderAvailability;

/** The library declares this type but does not re-export it from its entry. */
type TimeRangeFilter = {
  operator: 'between';
  startTime: string;
  endTime: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** A night's sleep starts the previous evening, so look back far enough. */
const SLEEP_LOOKBACK_MS = 18 * 60 * 60 * 1000;

type HealthConnectModule = typeof import('react-native-health-connect');

/**
 * Loaded lazily and only on Android: the library resolves its TurboModule at
 * import time, which throws on any other platform. A type-only import above
 * keeps the types without the runtime cost.
 */
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

/** Kept out of release builds; the console is a development instrument. */
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

/** A readable dump of what came back, so a wrong unit is obvious on sight. */
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

    /**
     * Normalised to our own vocabulary before the version check, so the
     * decision itself stays a pure function this file does not own.
     *
     * `getSdkStatus` resolves a bare `number`, so there is no exhaustiveness
     * checking to lean on here — anything unrecognised is treated as
     * unavailable rather than assumed usable.
     */
    const kind: SdkStatusKind =
      status === hc.SdkAvailabilityStatus.SDK_AVAILABLE
        ? 'available'
        : status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
        ? 'updateRequired'
        : 'unavailable';

    // Android only by this point — `nativeModule()` already returned for every
    // other platform, so Platform.Version is the numeric API level.
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

/**
 * Shows the Android permission sheet and reports what was actually granted.
 * A user who grants three of five is a normal outcome, not an error.
 */
export async function requestPermissions(): Promise<HealthConnectField[]> {
  const hc = nativeModule();
  if (hc === null) {
    return [];
  }
  try {
    const returned = await hc.requestPermission(READ_PERMISSIONS);
    log('permission request returned', returned);
  } catch (error) {
    // Backing out of the sheet lands here. Not an error worth surfacing —
    // the read below reports whatever is actually held.
    log('permission request failed', error);
  }

  /**
   * The answer comes from the system, never from what the request returned.
   *
   * `requestPermission` reports what that particular request granted, so when
   * everything was already granted the sheet does not appear and it resolves
   * **empty** — indistinguishable from a refusal. Reading the real state
   * afterwards is the only way to tell "already connected" from "declined",
   * and getting it wrong offers to connect something already connected.
   */
  return getGrantedFields();
}

/** What we hold right now, without prompting — used on every app resume. */
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

/**
 * Sends the user to the system Health Connect screen. The spec is explicit
 * that revoking happens there, not in a toggle of ours: the platform only
 * applies an in-app revoke after a process restart, so an in-app switch would
 * keep working for the rest of the session and look broken.
 */
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
    // A revoked permission surfaces here as a native security error. Treat it
    // exactly like "not granted" rather than failing the whole sync.
    log(`reading ${field} failed`, error);
    return null;
  }
}

/**
 * Today's device data.
 *
 * Day boundaries are explicit: the daily totals run from device-local
 * midnight to now, so a check-in at 12:05 AM does not read as a day where the
 * user did nothing. Weight and height look back further because they are
 * slow-moving facts rather than daily totals.
 */
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
