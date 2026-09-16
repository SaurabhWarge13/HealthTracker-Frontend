import { makePendingOp, type PendingOp, type SyncOpKind } from '@/domain/sync';
import {
  initialSyncState,
  opDiscarded,
  opEnqueued,
  opFailed,
  opRetryRequested,
  opRetryScheduled,
  transientFailuresRevived,
  opStarted,
  opSucceeded,
  syncCleared,
  syncReducer,
  type SyncState,
} from '@/store/sync/syncSlice';
import type { CheckIn } from '@/domain/checkins/types';

const checkIn = (id: string, weightKg = 72): CheckIn => ({
  id,
  createdAt: 1_700_000_000_000,
  weightKg,
  heightCm: null,
  steps: null,
  sleepMinutes: null,
  waterMl: null,
  mood: null,
  notes: '',
  sources: {},
});

let sequence = 0;
const op = (
  kind: SyncOpKind,
  entityId: string,
  payload: CheckIn | null = null,
): PendingOp => makePendingOp(`op_${(sequence += 1)}`, kind, entityId, payload, 1_000);

const reduce = (state: SyncState, ...actions: Parameters<typeof syncReducer>[1][]) =>
  actions.reduce(syncReducer, state);

describe('opEnqueued', () => {
  it('keeps one op per check-in', () => {
    const state = reduce(
      initialSyncState,
      opEnqueued(op('create', 'a', checkIn('a', 72))),
      opEnqueued(op('update', 'a', checkIn('a', 71))),
      opEnqueued(op('update', 'a', checkIn('a', 70))),
    );

    expect(state.ops).toHaveLength(1);
    expect(state.ops[0].kind).toBe('create');
    expect(state.ops[0].payload?.weightKg).toBe(70);
  });

  it('drops both when a check-in is created and deleted offline', () => {
    const state = reduce(
      initialSyncState,
      opEnqueued(op('create', 'a', checkIn('a'))),
      opEnqueued(op('delete', 'a')),
    );
    expect(state.ops).toHaveLength(0);
  });

  it('queues behind an op that is already on the wire', () => {
    const first = op('create', 'a', checkIn('a', 72));
    const state = reduce(
      initialSyncState,
      opEnqueued(first),
      opStarted(first.opId),
      opEnqueued(op('update', 'a', checkIn('a', 70))),
    );

    expect(state.ops).toHaveLength(2);
    expect(state.ops[0].opId).toBe(first.opId);
    expect(state.ops[1].payload?.weightKg).toBe(70);
  });

  it('keeps ops for different check-ins separate', () => {
    const state = reduce(
      initialSyncState,
      opEnqueued(op('create', 'a', checkIn('a'))),
      opEnqueued(op('create', 'b', checkIn('b'))),
    );
    expect(state.ops.map(entry => entry.entityId)).toEqual(['a', 'b']);
  });
});

describe('op lifecycle', () => {
  it('clears the op and records when it landed', () => {
    // There is no server id to learn: the id the client sent is the row's id.
    const created = op('create', 'ck_1', checkIn('ck_1'));
    const state = reduce(
      initialSyncState,
      opEnqueued(created),
      opStarted(created.opId),
      opSucceeded({ opId: created.opId, at: 5_000 }),
    );

    expect(state.ops).toHaveLength(0);
    expect(state.lastSyncedAt).toBe(5_000);
    expect(state.inFlightOpId).toBeNull();
  });

  it('counts attempts and pushes the next try out', () => {
    const queued = op('create', 'a', checkIn('a'));
    const state = reduce(
      initialSyncState,
      opEnqueued(queued),
      opStarted(queued.opId),
      opRetryScheduled({
        opId: queued.opId,
        nextAttemptAt: 9_000,
        message: 'Offline',
        kind: 'offline',
      }),
    );

    expect(state.ops[0].attempts).toBe(1);
    expect(state.ops[0].nextAttemptAt).toBe(9_000);
    expect(state.ops[0].failed).toBe(false);
    expect(state.inFlightOpId).toBeNull();
  });

  it('keeps a failed op rather than dropping the work', () => {
    const queued = op('create', 'a', checkIn('a'));
    const state = reduce(
      initialSyncState,
      opEnqueued(queued),
      opFailed({
        opId: queued.opId,
        message: 'Some details need fixing.',
        kind: 'validation',
      }),
    );

    expect(state.ops).toHaveLength(1);
    expect(state.ops[0].failed).toBe(true);
    expect(state.ops[0].lastError).toBe('Some details need fixing.');
  });

  it('lets the user put a failed op back in the queue', () => {
    const queued = op('create', 'a', checkIn('a'));
    const state = reduce(
      initialSyncState,
      opEnqueued(queued),
      opFailed({ opId: queued.opId, message: 'nope', kind: 'validation' }),
      opRetryRequested({ opId: queued.opId, at: 7_000 }),
    );

    expect(state.ops[0].failed).toBe(false);
    expect(state.ops[0].attempts).toBe(0);
    expect(state.ops[0].nextAttemptAt).toBe(7_000);
  });

  it('revives a failure caused by the connection when the device is back', () => {
    const queued = op('create', 'a', checkIn('a'));
    const state = reduce(
      initialSyncState,
      opEnqueued(queued),
      opFailed({ opId: queued.opId, message: "You're offline.", kind: 'offline' }),
      transientFailuresRevived(5_000),
    );

    expect(state.ops[0].failed).toBe(false);
    expect(state.ops[0].attempts).toBe(0);
    expect(state.ops[0].nextAttemptAt).toBe(5_000);
    expect(state.ops[0].lastErrorKind).toBeNull();
  });

  it('leaves a rejected payload failed, however good the connection is', () => {
    const queued = op('create', 'a', checkIn('a'));
    const state = reduce(
      initialSyncState,
      opEnqueued(queued),
      opFailed({
        opId: queued.opId,
        message: 'Some details need fixing.',
        kind: 'validation',
      }),
      transientFailuresRevived(5_000),
    );

    expect(state.ops[0].failed).toBe(true);
    expect(state.ops[0].lastErrorKind).toBe('validation');
  });

  it('only removes an op when the user discards it', () => {
    const queued = op('create', 'a', checkIn('a'));
    const state = reduce(
      initialSyncState,
      opEnqueued(queued),
      opFailed({ opId: queued.opId, message: 'nope', kind: 'validation' }),
      opDiscarded(queued.opId),
    );
    expect(state.ops).toHaveLength(0);
  });

  it('clears everything when the account changes', () => {
    const state = reduce(
      initialSyncState,
      opEnqueued(op('create', 'a', checkIn('a'))),
      syncCleared(),
    );
    expect(state).toEqual(initialSyncState);
  });
});
