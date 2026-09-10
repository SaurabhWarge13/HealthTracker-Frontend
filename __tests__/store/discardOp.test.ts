/**
 * Discard has to leave local state somewhere honest.
 *
 * The old behaviour removed the queued op and stopped, which meant the device
 * kept showing a value the server would silently overwrite on some later
 * refetch — a create vanished, an edit reverted, a deleted check-in came back,
 * all without warning and at an unpredictable moment. These tests pin the
 * revert to the moment the user actually asks for it.
 */
import { createAppStore } from '@/store/store';
import {
  createCheckIn,
  deleteCheckIn,
  discardOp,
  updateCheckIn,
} from '@/store/checkins/checkinsCommands';
import { checkInsReplaced } from '@/store/checkins/checkinsSlice';
import { serverIdsRecorded } from '@/store/sync/syncSlice';
import type { CheckIn } from '@/domain/checkins/types';
import type { CheckInDraft } from '@/domain/checkins/types';

const draft = (weightKg: number): CheckInDraft => ({
  weightKg,
  heightCm: 175,
  steps: null,
  sleepMinutes: null,
  waterMl: null,
  mood: null,
  notes: '',
  sources: {},
});

const server = (id: string, weightKg: number): CheckIn => ({
  ...draft(weightKg),
  id,
  createdAt: 1_700_000_000_000,
});

/** A check-in the server already knows about, as a pull would leave it. */
const withSynced = (entry: CheckIn) => {
  const store = createAppStore();
  store.dispatch(checkInsReplaced({ entries: [entry], at: 1_000 }));
  store.dispatch(serverIdsRecorded({ [entry.id]: entry.id }));
  return store;
};

describe('discardOp', () => {
  it('removes a check-in whose create was never sent', () => {
    const store = createAppStore();
    const id = store.dispatch(createCheckIn(draft(71)));

    expect(store.getState().checkins.byId[id]).toBeDefined();

    const opId = store.getState().sync.ops[0].opId;
    store.dispatch(discardOp(opId));

    // Nothing to go back to: the server never had it.
    expect(store.getState().checkins.byId[id]).toBeUndefined();
    expect(store.getState().checkins.allIds).not.toContain(id);
    expect(store.getState().sync.ops).toHaveLength(0);
  });

  it('puts an edited check-in back to the value the server holds', () => {
    const store = withSynced(server('srv_1', 72));

    store.dispatch(updateCheckIn('srv_1', { weightKg: 71 }));
    expect(store.getState().checkins.byId.srv_1.weightKg).toBe(71);

    store.dispatch(discardOp(store.getState().sync.ops[0].opId));

    expect(store.getState().checkins.byId.srv_1.weightKg).toBe(72);
    expect(store.getState().sync.ops).toHaveLength(0);
  });

  it('restores a deleted check-in, because the server still has it', () => {
    const store = withSynced(server('srv_1', 72));

    store.dispatch(deleteCheckIn('srv_1'));
    expect(store.getState().checkins.byId.srv_1).toBeUndefined();

    store.dispatch(discardOp(store.getState().sync.ops[0].opId));

    // Reappearing is correct here — the delete never reached the server, so
    // pretending it is gone would diverge from what a refetch would show.
    expect(store.getState().checkins.byId.srv_1.weightKg).toBe(72);
    expect(store.getState().checkins.allIds).toContain('srv_1');
    expect(store.getState().sync.ops).toHaveLength(0);
  });

  it('reverts a burst of edits all the way back, not to the second-last one', () => {
    const store = withSynced(server('srv_1', 72));

    store.dispatch(updateCheckIn('srv_1', { weightKg: 71 }));
    store.dispatch(updateCheckIn('srv_1', { weightKg: 70 }));
    store.dispatch(updateCheckIn('srv_1', { weightKg: 69 }));

    // Compacted to one op the whole way.
    expect(store.getState().sync.ops).toHaveLength(1);

    store.dispatch(discardOp(store.getState().sync.ops[0].opId));

    // 72 is what the server holds. 71 and 70 were never sent anywhere.
    expect(store.getState().checkins.byId.srv_1.weightKg).toBe(72);
  });

  it('does nothing when the op is already gone', () => {
    const store = withSynced(server('srv_1', 72));
    const before = store.getState().checkins.byId.srv_1;

    store.dispatch(discardOp('op_that_never_existed'));

    expect(store.getState().checkins.byId.srv_1).toEqual(before);
  });
});
