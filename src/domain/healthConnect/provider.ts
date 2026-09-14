import type { HealthConnectStatus } from '@/store/healthConnect/healthConnectSlice';

export const PROVIDER_PACKAGE = 'com.google.android.apps.healthdata';

export const MIN_PROVIDER_API_LEVEL = 26;

export const FRAMEWORK_PROVIDER_API_LEVEL = 34;

export type SdkStatusKind = 'available' | 'updateRequired' | 'unavailable';

export type ProviderAvailability =
  | 'AVAILABLE'
  | 'UPDATE_REQUIRED'
  | 'PROVIDER_MISSING'
  | 'PROVIDER_DISABLED'
  | 'NOT_SUPPORTED';

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
  if (apiLevel < MIN_PROVIDER_API_LEVEL) {
    return 'NOT_SUPPORTED';
  }
  return apiLevel >= FRAMEWORK_PROVIDER_API_LEVEL
    ? 'PROVIDER_DISABLED'
    : 'PROVIDER_MISSING';
}

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
