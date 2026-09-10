/**
 * The provider decision: whether Health Connect can work here, and if not,
 * whether the user can do anything about it.
 *
 * The platform hands us one `SDK_UNAVAILABLE` value for two different
 * situations — "not installed" and "this device never can" — so everything
 * these tests protect is our own inference from the OS version. Getting the
 * boundary wrong is silent: a user is either shown a dead-end Play Store link
 * or shown nothing at all when installing would have worked.
 */
import {
  FRAMEWORK_PROVIDER_API_LEVEL,
  MIN_PROVIDER_API_LEVEL,
  PROVIDER_PACKAGE,
  availabilityFor,
  providerIssueFor,
} from '@/domain/healthConnect/provider';
import type { HealthConnectStatus } from '@/store/healthConnect/healthConnectSlice';

describe('availabilityFor', () => {
  it('passes an available provider straight through, whatever the OS', () => {
    expect(availabilityFor('available', 26)).toBe('AVAILABLE');
    expect(availabilityFor('available', 33)).toBe('AVAILABLE');
    expect(availabilityFor('available', 34)).toBe('AVAILABLE');
  });

  it('treats a stale provider as needing an update, whatever the OS', () => {
    // Installed, so the OS version cannot change what the user has to do.
    expect(availabilityFor('updateRequired', 30)).toBe('UPDATE_REQUIRED');
    expect(availabilityFor('updateRequired', 34)).toBe('UPDATE_REQUIRED');
  });

  describe('when the provider is unavailable, the OS version decides', () => {
    it('is installable on Android 9-13, which is the case that was lost', () => {
      // The whole point of the change: these users can fix this themselves.
      expect(availabilityFor('unavailable', 28)).toBe('PROVIDER_MISSING');
      expect(availabilityFor('unavailable', 30)).toBe('PROVIDER_MISSING');
      expect(availabilityFor('unavailable', 33)).toBe('PROVIDER_MISSING');
    });

    it('is disabled rather than missing from Android 14, where it ships in the OS', () => {
      // Sending these users to the Play Store would be a dead end.
      expect(availabilityFor('unavailable', FRAMEWORK_PROVIDER_API_LEVEL)).toBe(
        'PROVIDER_DISABLED',
      );
      expect(availabilityFor('unavailable', 35)).toBe('PROVIDER_DISABLED');
    });

    it('is terminal below the floor, where installing cannot help', () => {
      expect(availabilityFor('unavailable', MIN_PROVIDER_API_LEVEL - 1)).toBe(
        'NOT_SUPPORTED',
      );
      expect(availabilityFor('unavailable', 21)).toBe('NOT_SUPPORTED');
    });

    it('is installable exactly at the floor, not terminal', () => {
      // An off-by-one here hides the feature from a device that supports it.
      expect(availabilityFor('unavailable', MIN_PROVIDER_API_LEVEL)).toBe(
        'PROVIDER_MISSING',
      );
    });

    it('is missing, not disabled, one version below the framework build', () => {
      expect(availabilityFor('unavailable', FRAMEWORK_PROVIDER_API_LEVEL - 1)).toBe(
        'PROVIDER_MISSING',
      );
    });
  });
});

describe('providerIssueFor', () => {
  it('names an action for each of the three recoverable states', () => {
    expect(providerIssueFor('PROVIDER_MISSING')).toBe('missing');
    expect(providerIssueFor('PROVIDER_DISABLED')).toBe('disabled');
    expect(providerIssueFor('UPDATE_REQUIRED')).toBe('updateRequired');
  });

  it('reports nothing to fix for a terminal device', () => {
    // Not "no problem" — no remedy. Both render as no prompt.
    expect(providerIssueFor('NOT_SUPPORTED')).toBeNull();
  });

  it('reports nothing to fix once the provider works, whatever the permissions', () => {
    // A permission the user declined is not a provider issue, and must not
    // be answered with an install prompt.
    const usable: HealthConnectStatus[] = [
      'NOT_CONNECTED',
      'PARTIALLY_CONNECTED',
      'CONNECTED',
    ];
    for (const status of usable) {
      expect(providerIssueFor(status)).toBeNull();
    }
  });
});

describe('the provider package name', () => {
  it('is the Play Store id the install link is built from', () => {
    // The library keeps its own copy private, so ours is the one that ships.
    expect(PROVIDER_PACKAGE).toBe('com.google.android.apps.healthdata');
  });
});
