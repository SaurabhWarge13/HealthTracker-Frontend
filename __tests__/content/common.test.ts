import { discardMessage, unsyncedMessage } from '@/content';
import { makePendingOp } from '@/domain/sync';
import type { CheckIn } from '@/domain/checkins/types';

const checkIn = (weightKg: number): CheckIn => ({
  id: 'local_abc',
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

const NOW = 1_700_000_000_000;

describe('unsyncedMessage', () => {
  it('uses singular wording for one change', () => {
    const message = unsyncedMessage(1, true);
    expect(message).toContain('1 change is');
    expect(message).toContain('so it would be lost');
  });

  it('uses plural wording for several changes', () => {
    const message = unsyncedMessage(3, true);
    expect(message).toContain('3 changes are');
    expect(message).toContain('so they would be lost');
  });

  it('omits the offline clause when online', () => {
    expect(unsyncedMessage(1, true)).not.toMatch(/offline/i);
  });

  it('leads with the offline clause when offline', () => {
    expect(unsyncedMessage(1, false)).toMatch(/^You're offline/);
  });

  it('keeps the count and the warning when offline', () => {
    const message = unsyncedMessage(2, false);
    expect(message).toContain('2 changes are');
    expect(message).toContain('lost for good');
  });
});

describe('discardMessage', () => {
  it('explains that a never-sent create is removed outright', () => {
    const op = makePendingOp('op1', 'create', 'local_abc', checkIn(72), NOW);
    expect(discardMessage(op)).toContain('never sent');
  });

  it('names the server version an update reverts to', () => {
    const op = makePendingOp(
      'op2',
      'update',
      'srv_1',
      checkIn(73),
      NOW,
      checkIn(72),
    );
    expect(discardMessage(op)).toContain('72.0 kg');
  });

  it('warns that a discarded delete reappears', () => {
    const op = makePendingOp('op3', 'delete', 'srv_1', null, NOW, checkIn(72));
    expect(discardMessage(op)).toContain('reappear in your history');
  });

  it('falls back to the removal wording when there is no before snapshot', () => {
    const op = makePendingOp('op4', 'update', 'srv_1', checkIn(73), NOW, null);
    expect(discardMessage(op)).toContain('never sent');
  });
});
