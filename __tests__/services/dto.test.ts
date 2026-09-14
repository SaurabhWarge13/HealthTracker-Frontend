import {
  toCheckIn,
  toCheckInBody,
  toProfileBody,
  toProfilePatch,
  type CheckInDto,
} from '@/services/api/dto';
import type { CheckIn } from '@/domain/checkins/types';

const dto = (over: Partial<CheckInDto> = {}): CheckInDto => ({
  id: 'srv_1',
  weightKg: 72.4,
  heightCm: 175,
  sleepMinutes: 430,
  steps: 9000,
  waterMl: 2400,
  mood: 4,
  notes: 'Felt good',
  sources: {
    weight: 'manual',
    height: 'manual',
    sleep: 'health_connect',
    steps: 'health_connect',
    water: 'manual',
  },
  recordedAt: '2026-09-06T08:00:00.000Z',
  createdAt: '2026-09-07T12:00:00.000Z',
  updatedAt: '2026-09-07T12:00:00.000Z',
  ...over,
});

const domain = (over: Partial<CheckIn> = {}): CheckIn => ({
  id: 'local_1',
  createdAt: Date.parse('2026-09-06T08:00:00.000Z'),
  weightKg: 72.4,
  heightCm: 175,
  steps: 9000,
  sleepMinutes: 430,
  waterMl: 2400,
  mood: 4,
  notes: 'Felt good',
  sources: { weight: 'manual', steps: 'healthConnect' },
  ...over,
});

describe('toCheckIn', () => {
  it('takes recordedAt as createdAt, not the row insert time', () => {
    const result = toCheckIn(dto());
    expect(result.createdAt).toBe(Date.parse('2026-09-06T08:00:00.000Z'));
    expect(result.createdAt).not.toBe(Date.parse('2026-09-07T12:00:00.000Z'));
  });

  it('turns a null note into an empty string', () => {
    expect(toCheckIn(dto({ notes: null })).notes).toBe('');
  });

  it('converts snake_case sources and drops height', () => {
    const result = toCheckIn(dto());
    expect(result.sources).toEqual({
      weight: 'manual',
      sleep: 'healthConnect',
      steps: 'healthConnect',
      water: 'manual',
    });
    expect('height' in result.sources).toBe(false);
  });

  it('refuses a mood outside 1–5 rather than trusting it', () => {
    expect(toCheckIn(dto({ mood: 9 })).mood).toBeNull();
    expect(toCheckIn(dto({ mood: 0 })).mood).toBeNull();
    expect(toCheckIn(dto({ mood: null })).mood).toBeNull();
    expect(toCheckIn(dto({ mood: 3 })).mood).toBe(3);
  });

  it('survives a response with no sources object at all', () => {
    const missing = { ...dto(), sources: undefined } as unknown as CheckInDto;
    expect(toCheckIn(missing).sources).toEqual({});
  });
});

describe('toCheckInBody', () => {
  it('sends recordedAt with a zone — the server rejects a naked timestamp', () => {
    const body = toCheckInBody(domain());
    expect(body.recordedAt).toBe('2026-09-06T08:00:00.000Z');
    expect(String(body.recordedAt)).toMatch(/Z$/);
  });

  it('sends all five source keys, including height', () => {
    const body = toCheckInBody(domain()) as { sources: Record<string, string> };
    expect(Object.keys(body.sources).sort()).toEqual([
      'height',
      'sleep',
      'steps',
      'water',
      'weight',
    ]);
  });

  it('converts camelCase sources back to snake_case', () => {
    const body = toCheckInBody(domain()) as { sources: Record<string, string> };
    expect(body.sources.steps).toBe('health_connect');
    expect(body.sources.weight).toBe('manual');
  });

  it('defaults an unrecorded source to manual rather than claiming the device', () => {
    const body = toCheckInBody(
      domain({ sources: {} }),
    ) as { sources: Record<string, string> };
    expect(Object.values(body.sources).every(value => value === 'manual')).toBe(true);
  });

  it('omits an empty note rather than sending null', () => {
    const body = toCheckInBody(domain({ notes: '   ' }));
    expect(body.notes).toBeUndefined();
    expect('notes' in body).toBe(false);
  });

  it('omits every unset optional rather than sending null', () => {
    const body = toCheckInBody(
      domain({
        heightCm: null,
        steps: null,
        sleepMinutes: null,
        waterMl: null,
        mood: null,
        notes: '',
      }),
    );

    for (const key of [
      'heightCm',
      'steps',
      'sleepMinutes',
      'waterMl',
      'mood',
      'notes',
    ]) {
      expect(key in body).toBe(false);
    }
    expect(body.weightKg).toBe(72.4);
    expect(body.recordedAt).toBe('2026-09-06T08:00:00.000Z');
    expect(Object.keys(body.sources as object)).toHaveLength(5);
  });

  it('keeps optionals that do have a value', () => {
    const body = toCheckInBody(domain({ notes: 'Felt good' }));
    expect(body.notes).toBe('Felt good');
    expect(body.steps).toBe(9000);
    expect(body.mood).toBe(4);
  });

  it('round-trips through the server shape without drift', () => {
    const original = domain({ id: 'srv_1' });
    const body = toCheckInBody(original) as Record<string, unknown>;
    const back = toCheckIn({ ...dto(), ...body } as CheckInDto);

    expect(back.weightKg).toBe(original.weightKg);
    expect(back.createdAt).toBe(original.createdAt);
    expect(back.steps).toBe(original.steps);
    expect(back.sources.steps).toBe('healthConnect');
  });
});

describe('profile mapping', () => {
  it('renames every field on the way in', () => {
    expect(
      toProfilePatch({
        name: 'Demo User',
        baselineWeight: 76.5,
        height: 175,
        stepGoal: 10_000,
        waterGoal: 2500,
        sleepGoal: 480,
        targetWeight: 70,
        updatedAt: '2026-09-06T08:00:00.000Z',
      }),
    ).toEqual({
      name: 'Demo User',
      baselineWeightKg: 76.5,
      heightCm: 175,
      stepGoal: 10_000,
      waterGoalMl: 2500,
      sleepGoalMinutes: 480,
      targetWeightKg: 70,
    });
  });

  it('turns a null name into an empty string', () => {
    const patch = toProfilePatch({
      name: null,
      baselineWeight: 76.5,
      height: null,
      stepGoal: null,
      waterGoal: null,
      sleepGoal: null,
      targetWeight: null,
      updatedAt: '2026-09-06T08:00:00.000Z',
    });
    expect(patch.name).toBe('');
  });

  it('sends every field that has a value, because PUT is a full replace', () => {
    const body = toProfileBody({
      name: 'Sam',
      baselineWeightKg: 76.5,
      heightCm: 175,
      stepGoal: 10000,
      waterGoalMl: 2500,
      sleepGoalMinutes: 480,
      targetWeightKg: 70,
    });
    expect(Object.keys(body).sort()).toEqual([
      'baselineWeight',
      'height',
      'name',
      'sleepGoal',
      'stepGoal',
      'targetWeight',
      'waterGoal',
    ]);
  });

  it('omits unset fields rather than sending null', () => {
    const body = toProfileBody({
      name: '',
      baselineWeightKg: 76.5,
      heightCm: null,
      stepGoal: null,
      waterGoalMl: null,
      sleepGoalMinutes: null,
      targetWeightKg: null,
    });
    expect(Object.keys(body)).toEqual(['baselineWeight']);
    expect(body.baselineWeight).toBe(76.5);
    expect('name' in body).toBe(false);
  });
});
