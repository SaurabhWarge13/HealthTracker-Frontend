import {
  checkInSchema,
  parseSleepInput,
  SLEEP_MAX_MINUTES,
} from '@/domain/checkins/validation';

/** A check-in that is valid apart from whatever the test overrides. */
const values = (overrides: Partial<Record<string, string>> = {}) => ({
  weight: '72.0',
  steps: '',
  sleep: '',
  water: '',
  height: '',
  notes: '',
  ...overrides,
});

describe('parseSleepInput', () => {
  it.each([
    ['hours and minutes', '7h 30m', 450],
    ['hours only', '7h', 420],
    ['hours with no unit suffix on the minutes', '7h 20', 440],
    ['clock notation', '7:20', 440],
    ['a whole number of hours', '8', 480],
    ['a fractional number of hours', '7.5', 450],
    ['the upper boundary', '24', SLEEP_MAX_MINUTES],
  ])('reads %s', (_label, input, expected) => {
    expect(parseSleepInput(input)).toBe(expected);
  });

  it('treats a bare number as hours even when it is out of range', () => {
    // The old fallback read anything over 24 as minutes, so "26" quietly
    // became a 26-minute night instead of failing the range check.
    expect(parseSleepInput('26')).toBe(26 * 60);
  });

  it.each([
    ['empty', ''],
    ['spaces only', '   '],
  ])('returns null for %s so the field stays optional', (_label, input) => {
    expect(parseSleepInput(input)).toBeNull();
  });

  it('returns null for nonsense', () => {
    expect(parseSleepInput('last night')).toBeNull();
  });
});

describe('checkInSchema — sleep must be between 0 and 24 hours', () => {
  it.each([
    ['exactly 24 hours', '24'],
    ['exactly 24 hours written with a unit', '24h'],
    ['a normal night', '7h 30m'],
    ['zero', '0'],
  ])('accepts %s', (_label, sleep) => {
    expect(checkInSchema.safeParse(values({ sleep })).success).toBe(true);
  });

  it.each([
    ['a bare number over 24', '26'],
    ['hours over 24', '25h'],
    ['a number that used to be read as minutes', '440'],
    ['clock notation over 24', '25:30'],
  ])('rejects %s', (_label, sleep) => {
    expect(checkInSchema.safeParse(values({ sleep })).success).toBe(false);
  });

  it('names the range rather than talking about days', () => {
    const result = checkInSchema.safeParse(values({ sleep: '26' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Enter sleep between 0 and 24 hours.',
      );
    }
  });

  it('stores minutes, not the typed string', () => {
    expect(checkInSchema.parse(values({ sleep: '7h 30m' })).sleep).toBe(450);
  });

  it('leaves sleep undefined when the field is blank', () => {
    const parsed = checkInSchema.parse(values());
    expect(parsed.sleep).toBeUndefined();
  });
});

describe('checkInSchema — weight is the one required measurement', () => {
  /**
   * Why the form needs no "at least one of steps/sleep/water" rule: a valid
   * check-in already carries a weight, so it is never empty.
   */
  it('accepts a check-in with a weight and nothing else', () => {
    expect(checkInSchema.safeParse(values()).success).toBe(true);
  });

  it('rejects a check-in with no weight, however much else is filled in', () => {
    const result = checkInSchema.safeParse(
      values({ weight: '', steps: '8000', sleep: '7h', water: '2' }),
    );
    expect(result.success).toBe(false);
  });
});
