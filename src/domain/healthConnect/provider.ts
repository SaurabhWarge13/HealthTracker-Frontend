import type { HealthConnectStatus } from '@/store/healthConnect/healthConnectSlice';

/** The provider app's own package name. The library keeps this private. */
export const PROVIDER_PACKAGE = 'com.google.android.apps.healthdata';

/**
 * Below this, no amount of installing helps.
 *
 * 26 rather than 28: react-native-health-connect's README states the Health
 * Connect API requires `minSdkVersion=26`, and this project's own minSdk is 26
 * (android/build.gradle), so on Android this floor is not currently reachable.
 * The check stays because being wrong in the other direction — offering a Play
 * Store link to a device that cannot install the provider — is a dead end, and
 * because minSdk may drop again.
 */
export const MIN_PROVIDER_API_LEVEL = 26;

/**
 * From Android 14 the provider is part of the framework, so "unavailable" there
 * cannot mean "not installed" — it means switched off, or a build without it.
 * Sending that user to the Play Store would be useless; system settings is the
 * only place they can act.
 */
export const FRAMEWORK_PROVIDER_API_LEVEL = 34;

/** The library returns a bare `number`; normalised here so this file stays pure. */
export type SdkStatusKind = 'available' | 'updateRequired' | 'unavailable';

export type ProviderAvailability =
  | 'AVAILABLE'
  /** Installed but stale — the Play Store listing fixes it. */
  | 'UPDATE_REQUIRED'
  /** Installable and absent — the Play Store listing fixes it. */
  | 'PROVIDER_MISSING'
  /** Present in the OS but switched off — only system settings fixes it. */
  | 'PROVIDER_DISABLED'
  /** Terminal. iOS, too old an OS, or a hard failure. Nothing to offer. */
  | 'NOT_SUPPORTED';

/** The recoverable states, named for what the user has to do about them. */
export type ProviderIssue = 'missing' | 'disabled' | 'updateRequired';

export function availabilityFor(
  kind: SdkStatusKind,
  apiLevel: number,
): ProviderAvailability {
  if (kind === 'available') {
    return 'AVAILABLE';
  }
  if (kind === 'updateRequired') {
    return 'UPDATE_REQUIRED';
  }
  // Unavailable, so the OS version decides what the user can do about it.
  if (apiLevel < MIN_PROVIDER_API_LEVEL) {
    return 'NOT_SUPPORTED';
  }
  return apiLevel >= FRAMEWORK_PROVIDER_API_LEVEL
    ? 'PROVIDER_DISABLED'
    : 'PROVIDER_MISSING';
}

/**
 * The one place that decides which statuses are worth showing the user a way
 * out of, so no screen re-derives it. `null` means either "nothing wrong" or
 * "nothing they can do" — both render as no recovery prompt.
 */
export function providerIssueFor(status: HealthConnectStatus): ProviderIssue | null {
  switch (status) {
    case 'PROVIDER_MISSING':
      return 'missing';
    case 'PROVIDER_DISABLED':
      return 'disabled';
    case 'UPDATE_REQUIRED':
      return 'updateRequired';
    default:
      return null;
  }
}
