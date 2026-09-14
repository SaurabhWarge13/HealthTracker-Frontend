import {
  healthConnectSyncFailed,
  healthConnectSynced,
  healthConnectSyncStarted,
  healthConnectReducer,
  initialHealthConnectState,
  type HealthConnectState,
  type HealthConnectStatus,
} from '@/store/healthConnect/healthConnectSlice';
import {
  selectHealthConnectProviderIssue,
  selectHealthConnectSupported,
  selectHealthConnectUsable,
} from '@/store/healthConnect/healthConnectSelectors';
import type { RootState } from '@/store/rootReducer';

const reduce = (
  state: HealthConnectState,
  ...actions: Parameters<typeof healthConnectReducer>[1][]
) => actions.reduce((current, action) => healthConnectReducer(current, action), state);

const asRoot = (healthConnect: HealthConnectState) =>
  ({ healthConnect } as RootState);

const withStatus = (status: HealthConnectStatus) =>
  asRoot({ ...initialHealthConnectState, status });

const RECOVERABLE: HealthConnectStatus[] = [
  'PROVIDER_MISSING',
  'PROVIDER_DISABLED',
  'UPDATE_REQUIRED',
];

describe('defaults', () => {
  it('has not checked the device yet, so nothing is assumed', () => {
    expect(initialHealthConnectState.hasChecked).toBe(false);
  });
});

describe('recording an unusable provider', () => {
  it.each(RECOVERABLE)('stores %s rather than flattening it', status => {
    const state = reduce(
      initialHealthConnectState,
      healthConnectSyncStarted(),
      healthConnectSynced({ status }),
    );

    expect(state.status).toBe(status);
    expect(state.hasChecked).toBe(true);
    expect(state.syncing).toBe(false);
  });

  it('keeps the last good readings when a sync fails', () => {
    const withReadings = reduce(
      initialHealthConnectState,
      healthConnectSynced({ status: 'CONNECTED', today: { steps: 8432 } }),
    );

    const failed = reduce(withReadings, healthConnectSyncFailed('nope'));

    expect(failed.today.steps).toBe(8432);
    expect(failed.hasChecked).toBe(true);
  });
});

describe('selectHealthConnectSupported — does the card exist at all', () => {
  it('is false only for a device that can never use Health Connect', () => {
    expect(selectHealthConnectSupported(withStatus('NOT_SUPPORTED'))).toBe(false);
  });

  it.each(RECOVERABLE)('is true for %s, so the card can offer a way out', status => {
    expect(selectHealthConnectSupported(withStatus(status))).toBe(true);
  });

  it('is true once the provider works', () => {
    expect(selectHealthConnectSupported(withStatus('NOT_CONNECTED'))).toBe(true);
    expect(selectHealthConnectSupported(withStatus('CONNECTED'))).toBe(true);
  });
});

describe('selectHealthConnectUsable — can we actually read', () => {
  it.each([...RECOVERABLE, 'NOT_SUPPORTED' as const, 'NOT_CONNECTED' as const])(
    'is false for %s',
    status => {
      expect(selectHealthConnectUsable(withStatus(status))).toBe(false);
    },
  );

  it('is true only with permissions in hand', () => {
    expect(selectHealthConnectUsable(withStatus('PARTIALLY_CONNECTED'))).toBe(true);
    expect(selectHealthConnectUsable(withStatus('CONNECTED'))).toBe(true);
  });
});

describe('selectHealthConnectProviderIssue — what to offer the user', () => {
  it('names the remedy for each recoverable state', () => {
    expect(selectHealthConnectProviderIssue(withStatus('PROVIDER_MISSING'))).toBe(
      'missing',
    );
    expect(selectHealthConnectProviderIssue(withStatus('PROVIDER_DISABLED'))).toBe(
      'disabled',
    );
    expect(selectHealthConnectProviderIssue(withStatus('UPDATE_REQUIRED'))).toBe(
      'updateRequired',
    );
  });

  it('offers nothing when there is nothing to offer', () => {
    expect(selectHealthConnectProviderIssue(withStatus('NOT_SUPPORTED'))).toBeNull();
  });

  it('offers nothing for a declined permission, which is a different problem', () => {
    expect(selectHealthConnectProviderIssue(withStatus('NOT_CONNECTED'))).toBeNull();
    expect(selectHealthConnectProviderIssue(withStatus('CONNECTED'))).toBeNull();
  });
});
