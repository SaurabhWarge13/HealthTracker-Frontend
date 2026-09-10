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
  staleServerIdsPruned,
  syncCleared,
  syncReducer,
  type SyncState,
} from '@/store/sync/syncSlice';
import { resolveServerId } from '@/store/sync/syncSelectors';
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
    // Rewriting a request mid-send would either lose the edit or apply it
    // twice, so the new one waits its turn.
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
  it('records the server id without touching the local one', () => {
    const created = op('create', 'local_1', checkIn('local_1'));
    const state = reduce(
      initialSyncState,
      opEnqueued(created),
      opStarted(created.opId),
      opSucceeded({
        opId: created.opId,
        entityId: 'local_1',
        serverId: 'srv_9',
        at: 5_000,
      }),
    );

    expect(state.ops).toHaveLength(0);
    expect(state.serverIds).toEqual({ local_1: 'srv_9' });
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
    // The retry budget is about two minutes. A longer outage used to strand
    // the op behind a card the user had to find and tap, for something that
    // had already fixed itself.
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
    // It will be rejected again. Re-running it quietly would put the queue in
    // a loop the user cannot see.
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

describe('staleServerIdsPruned', () => {
  /**
   * The mapping outlives the op that created it, so nothing but this reducer
   * can decide it is dead. Every case below is one where getting that wrong
   * costs the user a check-in: a delete that can no longer name its row, or a
   * row that comes back because its id was forgotten.
   */
  const mapped = (serverIds: Record<string, string>): SyncState => ({
    ...initialSyncState,
    serverIds,
  });

  it('drops a mapping whose row the server no longer lists', () => {
    // Deleted on another device: nothing here references it any more.
    const state = reduce(
      mapped({ local_1: 'srv_9' }),
      staleServerIdsPruned({ keep: [] }),
    );
    expect(state.serverIds).toEqual({});
  });

  it('keeps a mapping for a row the server still lists', () => {
    const state = reduce(
      mapped({ local_1: 'srv_9' }),
      staleServerIdsPruned({ keep: ['local_1'] }),
    );
    expect(state.serverIds).toEqual({ local_1: 'srv_9' });
  });

  it('keeps a mapping a pending delete still needs', () => {
    // Reconcile removes a locally-deleted row from `keep`, so the op scan is
    // the only thing standing between this delete and losing its target.
    const state = reduce(
      mapped({ local_1: 'srv_9' }),
      opEnqueued(op('delete', 'local_1')),
      staleServerIdsPruned({ keep: [] }),
    );
    expect(state.serverIds).toEqual({ local_1: 'srv_9' });
  });

  it('keeps a mapping a failed delete still needs', () => {
    const queued = op('delete', 'local_1');
    const state = reduce(
      mapped({ local_1: 'srv_9' }),
      opEnqueued(queued),
      opFailed({ opId: queued.opId, message: 'nope', kind: 'server' }),
      staleServerIdsPruned({ keep: [] }),
    );
    // The user has not decided yet; Retry must still be able to name the row.
    expect(state.serverIds).toEqual({ local_1: 'srv_9' });
  });

  it('keeps a mapping an in-flight delete still needs', () => {
    const queued = op('delete', 'local_1');
    const state = reduce(
      mapped({ local_1: 'srv_9' }),
      opEnqueued(queued),
      opStarted(queued.opId),
      staleServerIdsPruned({ keep: [] }),
    );
    expect(state.inFlightOpId).toBe(queued.opId);
    expect(state.serverIds).toEqual({ local_1: 'srv_9' });
  });

  it('keeps mappings pending updates and creates still need', () => {
    const state = reduce(
      mapped({ local_1: 'srv_9', local_2: 'srv_8' }),
      opEnqueued(op('update', 'local_1', checkIn('local_1'))),
      opEnqueued(op('create', 'local_2', checkIn('local_2'))),
      staleServerIdsPruned({ keep: [] }),
    );
    expect(state.serverIds).toEqual({ local_1: 'srv_9', local_2: 'srv_8' });
  });

  it('drops a self-mapping even while the row is live', () => {
    // `resolveServerId` and `reconcileCheckIns` both fall back to the id
    // itself, so this entry says nothing that its absence does not.
    const state = reduce(
      mapped({ srv_9: 'srv_9' }),
      staleServerIdsPruned({ keep: ['srv_9'] }),
    );
    expect(state.serverIds).toEqual({});
  });

  it('leaves a local-keyed self-mapping alone', () => {
    const state = reduce(
      mapped({ local_1: 'local_1' }),
      staleServerIdsPruned({ keep: ['local_1'] }),
    );
    expect(state.serverIds).toEqual({ local_1: 'local_1' });
  });

  it('prunes only what is dead, in a mixed map', () => {
    const state = reduce(
      mapped({
        local_1: 'srv_9', // live row
        local_2: 'srv_8', // dead, but a delete needs it
        local_3: 'srv_7', // dead
        srv_6: 'srv_6', // redundant
      }),
      opEnqueued(op('delete', 'local_2')),
      staleServerIdsPruned({ keep: ['local_1', 'srv_6'] }),
    );
    expect(state.serverIds).toEqual({ local_1: 'srv_9', local_2: 'srv_8' });
  });

  it('touches nothing else on the slice', () => {
    const queued = op('delete', 'local_1');
    const state = reduce(
      { ...mapped({ local_1: 'srv_9' }), lastSyncedAt: 4_000 },
      opEnqueued(queued),
      staleServerIdsPruned({ keep: [] }),
    );
    expect(state.ops).toHaveLength(1);
    expect(state.lastSyncedAt).toBe(4_000);
  });
});

describe('resolveServerId', () => {
  it('maps a local id through to its server id', () => {
    expect(resolveServerId('local_1', { local_1: 'srv_9' })).toBe('srv_9');
  });

  it('uses a server-originated id as-is', () => {
    expect(resolveServerId('srv_3', {})).toBe('srv_3');
  });

  it('refuses to guess for an unsynced local id', () => {
    // Sending this would only ever 404; compaction should have folded it into
    // the create.
    expect(resolveServerId('local_2', {})).toBeNull();
  });
});
