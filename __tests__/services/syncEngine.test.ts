const mockRawBaseQuery = jest.fn();

jest.mock('@/services/api/baseQuery', () => ({
  rawBaseQuery: (...args: unknown[]) => mockRawBaseQuery(...args),
}));

jest.mock('@/security/tokenStore', () => ({
  getRefreshToken: () => Promise.resolve('stored-refresh'),
  saveRefreshToken: () => Promise.resolve(true),
  clearRefreshToken: () => Promise.resolve(undefined),
}));

import { makePendingOp } from '@/domain/sync';
import { baseApi } from '@/services/api/baseApi';
import { drainSyncQueue, pullCheckIns, pushProfile } from '@/services/sync';
import { loggedOut, sessionStarted } from '@/store/auth/authSlice';
import { opEnqueued, serverIdsRecorded } from '@/store/sync/syncSlice';
import {
  profileCompleted,
  profileSyncRetryRequested,
} from '@/store/profile/profileSlice';
import { createAppStore } from '@/store/store';
import type { CheckIn } from '@/domain/checkins/types';
import type { CheckInDto } from '@/services/api/dto';

const PAST = 1_000;

const checkIn = (id: string, weightKg = 72): CheckIn => ({
  id,
  createdAt: 1_700_000_000_000,
  weightKg,
  heightCm: 175,
  steps: null,
  sleepMinutes: null,
  waterMl: null,
  mood: null,
  notes: '',
  sources: {},
});

const dto = (over: Partial<CheckInDto> = {}): CheckInDto => ({
  id: 'srv_9',
  clientId: null,
  weightKg: 72,
  heightCm: 175,
  sleepMinutes: null,
  steps: null,
  waterMl: null,
  mood: null,
  notes: null,
  sources: {
    weight: 'manual',
    height: 'manual',
    sleep: 'manual',
    steps: 'manual',
    water: 'manual',
  },
  recordedAt: '2026-09-06T08:00:00.000Z',
  createdAt: '2026-09-06T08:00:00.000Z',
  updatedAt: '2026-09-06T08:00:00.000Z',
  ...over,
});

const notFound = () => ({
  error: { status: 404, data: { error: { code: 'NOT_FOUND', message: 'Resource not found' } } },
});

let activeStore: ReturnType<typeof createAppStore> | null = null;

const signedInStore = () => {
  activeStore = createAppStore();
  activeStore.dispatch(sessionStarted({ userId: 'u1', email: 'a@b.c', accessToken: 't' }));
  return activeStore;
};

const respond = (...responses: unknown[]) => {
  for (const response of responses) {
    mockRawBaseQuery.mockImplementationOnce(() => Promise.resolve(response));
  }
};

const requests = () =>
  mockRawBaseQuery.mock.calls.map(call => {
    const args = call[0] as { url: string; method?: string };
    return `${args.method ?? 'GET'} ${args.url}`;
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  activeStore?.dispatch(baseApi.util.resetApiState());
  activeStore = null;
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('drainSyncQueue', () => {
  it('treats a 404 on delete as success — the row is gone, which is the goal', async () => {
    const store = signedInStore();
    store.dispatch(serverIdsRecorded({ srv_1: 'srv_1' }));
    store.dispatch(opEnqueued(makePendingOp('op_1', 'delete', 'srv_1', null, PAST)));

    respond(notFound());
    await drainSyncQueue(store);

    expect(store.getState().sync.ops).toHaveLength(0);
    expect(store.getState().sync.lastSyncedAt).not.toBeNull();
  });

  it('re-establishes a check-in when PUT hits an id the server does not have', async () => {
    const store = signedInStore();
    store.dispatch(serverIdsRecorded({ local_1: 'stale_id' }));
    store.dispatch(
      opEnqueued(makePendingOp('op_1', 'update', 'local_1', checkIn('local_1', 71), PAST)),
    );

    respond(notFound(), { data: dto({ id: 'srv_new', clientId: 'local_1', weightKg: 71 }) });
    await drainSyncQueue(store);

    expect(requests()).toEqual(['PUT /checkins/stale_id', 'POST /checkins']);
    expect(store.getState().sync.ops).toHaveLength(0);
    expect(store.getState().sync.serverIds.local_1).toBe('srv_new');
  });

  it('sends an update as an upsert when no server id was ever learned', async () => {
    const store = signedInStore();
    store.dispatch(
      opEnqueued(makePendingOp('op_1', 'update', 'local_1', checkIn('local_1', 70), PAST)),
    );

    respond({ data: dto({ id: 'srv_9', clientId: 'local_1', weightKg: 70 }) });
    await drainSyncQueue(store);

    expect(requests()).toEqual(['POST /checkins']);
    expect(store.getState().sync.serverIds.local_1).toBe('srv_9');
    expect(store.getState().sync.ops).toHaveLength(0);
  });

  it('resolves a later update through the mapping the create recorded', async () => {
    const store = signedInStore();
    store.dispatch(
      opEnqueued(makePendingOp('op_1', 'create', 'local_1', checkIn('local_1'), PAST)),
    );

    respond({ data: dto({ id: 'srv_9', clientId: 'local_1' }) });
    await drainSyncQueue(store);

    expect(store.getState().sync.serverIds.local_1).toBe('srv_9');
    expect(store.getState().sync.ops).toHaveLength(0);

    store.dispatch(
      opEnqueued(makePendingOp('op_2', 'update', 'local_1', checkIn('local_1', 70), PAST)),
    );
    respond({ data: dto({ id: 'srv_9', clientId: 'local_1', weightKg: 70 }) });
    await drainSyncQueue(store);

    expect(requests()).toEqual(['POST /checkins', 'PUT /checkins/srv_9']);
  });

  it('resolves a later delete through the mapping the create recorded', async () => {
    const store = signedInStore();
    store.dispatch(
      opEnqueued(makePendingOp('op_1', 'create', 'local_1', checkIn('local_1'), PAST)),
    );

    respond({ data: dto({ id: 'srv_9', clientId: 'local_1' }) });
    await drainSyncQueue(store);

    store.dispatch(opEnqueued(makePendingOp('op_2', 'delete', 'local_1', null, PAST)));
    respond({ data: null });
    await drainSyncQueue(store);

    expect(requests()).toEqual(['POST /checkins', 'DELETE /checkins/srv_9']);
    expect(store.getState().sync.serverIds.local_1).toBeUndefined();
  });

  it('keeps a validation failure visible instead of retrying it forever', async () => {
    const store = signedInStore();
    store.dispatch(
      opEnqueued(makePendingOp('op_1', 'create', 'local_1', checkIn('local_1'), PAST)),
    );

    respond({
      error: { status: 400, data: { error: { code: 'VALIDATION_ERROR', message: 'nope' } } },
    });
    await drainSyncQueue(store);

    const op = store.getState().sync.ops[0];
    expect(op.failed).toBe(true);
    expect(op.lastErrorKind).toBe('validation');
    expect(mockRawBaseQuery).toHaveBeenCalledTimes(1);
  });

  it('reschedules a transport failure rather than giving up on it', async () => {
    const store = signedInStore();
    store.dispatch(
      opEnqueued(makePendingOp('op_1', 'create', 'local_1', checkIn('local_1'), PAST)),
    );

    respond({ error: { status: 'FETCH_ERROR', error: 'offline' } });
    await drainSyncQueue(store);

    const op = store.getState().sync.ops[0];
    expect(op.failed).toBe(false);
    expect(op.attempts).toBe(1);
    expect(op.lastErrorKind).toBe('network');
  });
});

describe('pullCheckIns', () => {
  it('recovers the local id mapping from the clientId the server echoes back', async () => {
    const store = signedInStore();
    respond({ data: [dto({ id: 'srv_9', clientId: 'local_1' })] });

    await pullCheckIns(store);

    expect(store.getState().sync.serverIds.local_1).toBe('srv_9');
    expect(store.getState().checkins.allIds).toEqual(['local_1']);
  });

  it('stores nothing for a server-only row, which needs no mapping', async () => {
    const store = signedInStore();
    respond({ data: [dto({ id: 'srv_9', clientId: null })] });

    await pullCheckIns(store);

    expect(store.getState().sync.serverIds).toEqual({});
    expect(store.getState().checkins.allIds).toEqual(['srv_9']);
  });

  it('drops a mapping for a row that is no longer on the server', async () => {
    const store = signedInStore();
    store.dispatch(serverIdsRecorded({ local_1: 'srv_9' }));

    respond({ data: [] });
    await pullCheckIns(store);

    expect(store.getState().sync.serverIds).toEqual({});
  });

  it('keeps a mapping a queued delete still needs, though the row is not listed', async () => {
    const store = signedInStore();
    store.dispatch(serverIdsRecorded({ local_1: 'srv_9' }));
    store.dispatch(opEnqueued(makePendingOp('op_1', 'delete', 'local_1', null, PAST)));

    respond({ data: [dto({ id: 'srv_9', clientId: 'local_1' })] });
    await pullCheckIns(store);

    expect(store.getState().checkins.allIds).toEqual([]);
    expect(store.getState().sync.serverIds.local_1).toBe('srv_9');
  });

  it('leaves serverIds alone when the pull fails', async () => {
    const store = signedInStore();
    store.dispatch(serverIdsRecorded({ local_1: 'srv_9' }));

    respond({ error: { status: 'FETCH_ERROR', error: 'offline' } });
    await pullCheckIns(store);

    expect(store.getState().sync.serverIds).toEqual({ local_1: 'srv_9' });
  });

  it('leaves local data alone when the fetch fails', async () => {
    const store = signedInStore();
    respond({ data: [dto({ id: 'srv_9' })] });
    await pullCheckIns(store);
    expect(store.getState().checkins.allIds).toHaveLength(1);

    respond({ error: { status: 'FETCH_ERROR', error: 'offline' } });
    await pullCheckIns(store);

    expect(store.getState().checkins.allIds).toHaveLength(1);
  });

  it('replays a pending delete over the server list so it cannot resurrect', async () => {
    const store = signedInStore();
    store.dispatch(serverIdsRecorded({ srv_9: 'srv_9' }));
    store.dispatch(opEnqueued(makePendingOp('op_1', 'delete', 'srv_9', null, PAST)));

    respond({ data: [dto({ id: 'srv_9' })] });
    await pullCheckIns(store);

    expect(store.getState().checkins.allIds).toEqual([]);
  });
});

describe('session fencing', () => {
  it('drops an op result that lands after logout', async () => {
    const store = signedInStore();
    store.dispatch(
      opEnqueued(makePendingOp('op_1', 'create', 'local_1', checkIn('local_1'), PAST)),
    );

    mockRawBaseQuery.mockImplementationOnce(async () => {
      store.dispatch(loggedOut());
      return { data: dto({ id: 'srv_9', clientId: 'local_1' }) };
    });
    await drainSyncQueue(store);

    expect(store.getState().sync.ops).toEqual([]);
    expect(store.getState().sync.serverIds).toEqual({});
    expect(store.getState().sync.lastSyncedAt).toBeNull();
  });

  it('drops an op result that lands after a DIFFERENT user has signed in', async () => {
    const store = signedInStore();
    store.dispatch(
      opEnqueued(makePendingOp('op_1', 'create', 'local_1', checkIn('local_1'), PAST)),
    );

    mockRawBaseQuery.mockImplementationOnce(async () => {
      store.dispatch(loggedOut());
      store.dispatch(
        sessionStarted({ userId: 'B', email: 'b@example.com', accessToken: 't' }),
      );
      return { data: dto({ id: 'srv_9', clientId: 'local_1' }) };
    });
    await drainSyncQueue(store);

    expect(store.getState().auth.userId).toBe('B');
    expect(store.getState().sync.serverIds).toEqual({});
    expect(store.getState().sync.ops).toEqual([]);
  });

  it('drops a pull that lands after logout', async () => {
    const store = signedInStore();

    mockRawBaseQuery.mockImplementationOnce(async () => {
      store.dispatch(loggedOut());
      return { data: [dto({ id: 'srv_9', clientId: 'local_1' })] };
    });
    await pullCheckIns(store);

    expect(store.getState().checkins.allIds).toEqual([]);
    expect(store.getState().sync.serverIds).toEqual({});
  });
});

describe('pullCheckIns single-flight', () => {
  it('coalesces concurrent callers onto one request and one reconciliation', async () => {
    const store = signedInStore();
    respond({ data: [dto({ id: 'srv_9', clientId: 'local_1' })] });

    await Promise.all([pullCheckIns(store), pullCheckIns(store)]);

    expect(requests()).toEqual(['GET /checkins']);
    expect(store.getState().checkins.allIds).toEqual(['local_1']);
  });

  it('allows a fresh pull once the previous one has settled', async () => {
    const store = signedInStore();
    respond(
      { data: [dto({ id: 'srv_9', clientId: 'local_1' })] },
      { data: [dto({ id: 'srv_9', clientId: 'local_1' })] },
    );

    await pullCheckIns(store);
    await pullCheckIns(store);

    expect(requests()).toEqual(['GET /checkins', 'GET /checkins']);
  });
});

describe('pull failure is recorded, never destructive', () => {
  it('keeps existing check-ins and flags the failure', async () => {
    const store = signedInStore();
    respond({ data: [dto({ id: 'srv_9', clientId: 'local_1' })] });
    await pullCheckIns(store);
    expect(store.getState().checkins.allIds).toEqual(['local_1']);

    respond({ error: { status: 'FETCH_ERROR', error: 'offline' } });
    await pullCheckIns(store);

    expect(store.getState().checkins.allIds).toEqual(['local_1']);
    expect(store.getState().checkins.lastPullFailed).toBe(true);
  });

  it('flags a failure on a later refresh, not only the first load', async () => {
    const store = signedInStore();
    respond({ data: [dto({ id: 'srv_9', clientId: 'local_1' })] });
    await pullCheckIns(store);

    respond({ error: { status: 'FETCH_ERROR', error: 'offline' } });
    await pullCheckIns(store);
    expect(store.getState().checkins.lastPullFailed).toBe(true);

    respond({ data: [dto({ id: 'srv_9', clientId: 'local_1' })] });
    await pullCheckIns(store);
    expect(store.getState().checkins.lastPullFailed).toBe(false);
  });
});

describe('pushProfile failure handling', () => {
  const withDirtyProfile = () => {
    const store = signedInStore();
    store.dispatch(
      profileCompleted({
        name: 'Ada',
        baselineWeightKg: 80,
        heightCm: 180,
        stepGoal: null,
        waterGoalMl: null,
        sleepGoalMinutes: null,
        targetWeightKg: null,
        baselineSetAt: 1_000,
      }),
    );
    return store;
  };

  it('clears the dirty flag when the server accepts it', async () => {
    const store = withDirtyProfile();
    respond({ data: { name: 'Ada', baselineWeight: 80 } });

    await pushProfile(store);

    expect(store.getState().profile.pendingSync).toBe(false);
    expect(store.getState().profile.syncFailed).toBe(false);
  });

  it('leaves a transport failure pending so the next trigger retries it', async () => {
    const store = withDirtyProfile();
    respond({ error: { status: 'FETCH_ERROR', error: 'offline' } });

    await pushProfile(store);

    expect(store.getState().profile.pendingSync).toBe(true);
    expect(store.getState().profile.syncFailed).toBe(false);

    respond({ data: { name: 'Ada', baselineWeight: 80 } });
    await pushProfile(store);
    expect(store.getState().profile.pendingSync).toBe(false);
  });

  it('stops re-sending a payload the server rejects', async () => {
    const store = withDirtyProfile();
    respond({
      error: {
        status: 400,
        data: { error: { code: 'VALIDATION_ERROR', message: 'Some details need fixing.' } },
      },
    });

    await pushProfile(store);
    expect(store.getState().profile.syncFailed).toBe(true);
    expect(store.getState().profile.lastError).toBeTruthy();
    expect(store.getState().profile.pendingSync).toBe(true);

    const before = mockRawBaseQuery.mock.calls.length;
    await pushProfile(store);
    await pushProfile(store);
    expect(mockRawBaseQuery.mock.calls.length).toBe(before);
  });

  it('sends again once the user asks it to', async () => {
    const store = withDirtyProfile();
    respond({
      error: {
        status: 400,
        data: { error: { code: 'VALIDATION_ERROR', message: 'nope' } },
      },
    });
    await pushProfile(store);
    const afterFailure = mockRawBaseQuery.mock.calls.length;

    store.dispatch(profileSyncRetryRequested());
    respond({ data: { name: 'Ada', baselineWeight: 80 } });
    await pushProfile(store);

    expect(mockRawBaseQuery.mock.calls.length).toBe(afterFailure + 1);
    expect(store.getState().profile.pendingSync).toBe(false);
  });
});
