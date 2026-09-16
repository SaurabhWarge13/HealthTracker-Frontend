import {
  canRetry,
  compactOps,
  makePendingOp,
  MAX_ATTEMPTS,
  mergePendingOp,
  nextDelayMs,
  reconcileCheckIns,
  type PendingOp,
  type SyncOpKind,
} from '@/domain/sync';
import type { CheckIn } from '@/domain/checkins/types';

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

let sequence = 0;
const op = (
  kind: SyncOpKind,
  entityId: string,
  payload: CheckIn | null = null,
  now = 1_000,
): PendingOp => makePendingOp(`op_${(sequence += 1)}`, kind, entityId, payload, now);

describe('mergePendingOp — one op per check-in, whatever the user did', () => {
  it('keeps the incoming op when nothing is queued', () => {
    const incoming = op('create', 'a', checkIn('a'));
    expect(mergePendingOp(undefined, incoming)).toBe(incoming);
  });

  it('keeps the delete when the create was already attempted', () => {
    const attempted = { ...op('create', 'a', checkIn('a')), attempts: 1 };
    const merged = mergePendingOp(attempted, op('delete', 'a'));

    expect(merged).not.toBeNull();
    expect(merged?.kind).toBe('delete');
  });

  it('carries the OLDEST before through a burst of edits', () => {
    const serverState = checkIn('a', 72);
    const first = { ...op('update', 'a', checkIn('a', 71)), before: serverState };
    const second = { ...op('update', 'a', checkIn('a', 70)), before: checkIn('a', 71) };

    expect(mergePendingOp(first, second)?.before).toEqual(serverState);
  });

  it('cancels a create that was deleted before it was sent', () => {
    const merged = mergePendingOp(op('create', 'a', checkIn('a')), op('delete', 'a'));
    expect(merged).toBeNull();
  });

  it('folds edits into a create that has not been sent', () => {
    const created = op('create', 'a', checkIn('a', 72));
    const edited = op('update', 'a', checkIn('a', 71));

    const merged = mergePendingOp(created, edited);

    expect(merged?.kind).toBe('create');
    expect(merged?.payload?.weightKg).toBe(71);
  });

  it('resets the retry budget when the payload changes', () => {
    const failing: PendingOp = {
      ...op('create', 'a', checkIn('a')),
      attempts: 3,
      failed: true,
      lastError: 'nope',
      nextAttemptAt: 99_999,
    };

    const merged = mergePendingOp(failing, op('update', 'a', checkIn('a', 70), 5_000));

    expect(merged?.attempts).toBe(0);
    expect(merged?.failed).toBe(false);
    expect(merged?.nextAttemptAt).toBe(5_000);
  });

  it('keeps only the newest of two edits', () => {
    const merged = mergePendingOp(
      op('update', 'a', checkIn('a', 72)),
      op('update', 'a', checkIn('a', 70)),
    );
    expect(merged?.kind).toBe('update');
    expect(merged?.payload?.weightKg).toBe(70);
  });

  it('lets a delete replace a pending edit', () => {
    const merged = mergePendingOp(
      op('update', 'a', checkIn('a')),
      op('delete', 'a'),
    );
    expect(merged?.kind).toBe('delete');
  });

  it('holds the original queue position so a burst does not jump the line', () => {
    const first = op('update', 'a', checkIn('a', 72), 1_000);
    const merged = mergePendingOp(first, op('update', 'a', checkIn('a', 70), 9_000));
    expect(merged?.opId).toBe(first.opId);
    expect(merged?.createdAt).toBe(1_000);
  });
});

describe('compactOps', () => {
  it('reduces a queue to at most one op per check-in', () => {
    const compacted = compactOps([
      op('create', 'a', checkIn('a', 72)),
      op('update', 'a', checkIn('a', 71)),
      op('update', 'a', checkIn('a', 70)),
      op('create', 'b', checkIn('b')),
    ]);

    expect(compacted).toHaveLength(2);
    expect(compacted[0].kind).toBe('create');
    expect(compacted[0].payload?.weightKg).toBe(70);
  });

  it('drops an entity entirely when its ops cancel out', () => {
    const compacted = compactOps([
      op('create', 'a', checkIn('a')),
      op('delete', 'a'),
      op('create', 'b', checkIn('b')),
    ]);

    expect(compacted.map(entry => entry.entityId)).toEqual(['b']);
  });

  it('preserves order between different check-ins', () => {
    const compacted = compactOps([
      op('create', 'a', checkIn('a')),
      op('create', 'b', checkIn('b')),
      op('update', 'a', checkIn('a', 70)),
    ]);
    expect(compacted.map(entry => entry.entityId)).toEqual(['a', 'b']);
  });

  it('leaves an already-minimal queue alone', () => {
    const ops = [op('create', 'a', checkIn('a')), op('delete', 'b')];
    expect(compactOps(ops)).toEqual(ops);
  });
});

describe('backoff', () => {
  it('grows with each attempt', () => {
    const delays = [0, 1, 2, 3].map(attempts => nextDelayMs(attempts, 1));
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[3]).toBeGreaterThan(delays[2]);
  });

  it('is capped, so a long outage does not push retries days out', () => {
    expect(nextDelayMs(100, 1)).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  it('jitters, so devices returning together do not stampede', () => {
    expect(nextDelayMs(3, 0)).toBeLessThan(nextDelayMs(3, 1));
  });

  it('stops retrying eventually rather than hammering forever', () => {
    expect(canRetry(MAX_ATTEMPTS - 1)).toBe(true);
    expect(canRetry(MAX_ATTEMPTS)).toBe(false);
  });
});

describe('reconcileCheckIns — the function that makes a refetch safe', () => {
  it('takes the server list when nothing is queued', () => {
    const result = reconcileCheckIns({
      server: [checkIn('s1'), checkIn('s2')],
      ops: [],
    });
    expect(result.map(entry => entry.id).sort()).toEqual(['s1', 's2']);
  });

  it('keeps a check-in created offline that the server has never seen', () => {
    const local = checkIn('local_1', 70);
    const result = reconcileCheckIns({
      server: [checkIn('s1')],
      ops: [op('create', 'local_1', local)],
    });

    expect(result.map(entry => entry.id).sort()).toEqual(['local_1', 's1']);
  });

  it('lets a pending edit win over the server copy', () => {
    const result = reconcileCheckIns({
      server: [checkIn('s1', 72)],
      ops: [op('update', 's1', checkIn('s1', 70))],
    });
    expect(result[0].weightKg).toBe(70);
  });

  it('does not let the server resurrect something deleted locally', () => {
    const result = reconcileCheckIns({
      server: [checkIn('s1'), checkIn('s2')],
      ops: [op('delete', 's1')],
    });
    expect(result.map(entry => entry.id)).toEqual(['s2']);
  });

  it('does not duplicate a row the client both holds and has queued', () => {
    // Client and server share one id namespace, so a pending edit lands on the
    // same map key as the server's copy rather than beside it.
    const result = reconcileCheckIns({
      server: [checkIn('ck_1', 70)],
      ops: [op('update', 'ck_1', checkIn('ck_1', 72))],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ck_1');
    expect(result[0].weightKg).toBe(72);
  });

  it('returns newest first, matching the read path', () => {
    const older = { ...checkIn('a'), createdAt: 1 };
    const newer = { ...checkIn('b'), createdAt: 2 };
    const result = reconcileCheckIns({ server: [older, newer], ops: [] });
    expect(result.map(entry => entry.id)).toEqual(['b', 'a']);
  });
});
