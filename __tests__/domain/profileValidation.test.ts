import {
  baselineSchema,
  goalOrNull,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  heightField,
  hoursToMinutes,
  minutesToHours,
  optionalHeightField,
  optionalSleepGoalHoursField,
} from '@/domain/profile/validation';

describe('heightField — required on the profile', () => {
  it.each([
    ['a plain number', '170'],
    ['the low boundary', String(HEIGHT_MIN_CM)],
    ['the high boundary', String(HEIGHT_MAX_CM)],
  ])('accepts %s', (_label, input) => {
    expect(heightField.safeParse(input).success).toBe(true);
  });

  it('parses to a number, not the typed string', () => {
    expect(heightField.parse('170')).toBe(170);
  });

  it.each([
    ['empty', ''],
    ['spaces only', '   '],
  ])('rejects %s', (_label, input) => {
    expect(heightField.safeParse(input).success).toBe(false);
  });

  it('asks for a height rather than complaining about a number', () => {
    const result = heightField.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Enter your height');
    }
  });

  it('rejects a fractional height — centimetres are whole numbers', () => {
    expect(heightField.safeParse('170.5').success).toBe(false);
  });

  it.each([
    ['below the range', String(HEIGHT_MIN_CM - 1)],
    ['above the range', String(HEIGHT_MAX_CM + 1)],
  ])('rejects a height %s', (_label, input) => {
    expect(heightField.safeParse(input).success).toBe(false);
  });

  it('still accepts what a real keyboard produces', () => {
    expect(heightField.parse(' 170 ')).toBe(170);
    expect(heightField.parse('1 70')).toBe(170);
  });
});

describe('baselineSchema — step 3 gates Continue on both fields', () => {
  it('accepts a complete baseline', () => {
    expect(baselineSchema.parse({ weight: '72.4', height: '170' })).toEqual({
      weight: 72.4,
      height: 170,
    });
  });

  it('rejects a valid weight with no height', () => {
    expect(baselineSchema.safeParse({ weight: '72.4', height: '' }).success).toBe(
      false,
    );
  });

  it('reports the failure against the height field', () => {
    const result = baselineSchema.safeParse({ weight: '72.4', height: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path[0])).toContain('height');
    }
  });

  it('still rejects a missing weight', () => {
    expect(baselineSchema.safeParse({ weight: '', height: '170' }).success).toBe(
      false,
    );
  });
});

describe('optionalHeightField — unchanged, for the check-in snapshot', () => {
  it('accepts a blank height, because a check-in may not know one', () => {
    const result = optionalHeightField.safeParse('');
    expect(result.success).toBe(true);
    expect(optionalHeightField.parse('')).toBeUndefined();
  });

  it('applies the same range as the required field', () => {
    expect(optionalHeightField.safeParse(String(HEIGHT_MAX_CM + 1)).success).toBe(
      false,
    );
    expect(optionalHeightField.parse('170')).toBe(170);
  });
});

describe('goalOrNull — a goal of zero is not a goal', () => {
  it('turns blank and zero into null alike', () => {
    expect(goalOrNull(undefined)).toBeNull();
    expect(goalOrNull(0)).toBeNull();
  });

  it('leaves a real goal alone', () => {
    expect(goalOrNull(10_000)).toBe(10_000);
    expect(goalOrNull(0.5)).toBe(0.5);
  });
});

describe('sleep goal — entered in hours, stored in minutes', () => {
  const parse = (value: string) => optionalSleepGoalHoursField.safeParse(value);

  it('converts whole and half hours', () => {
    expect(hoursToMinutes(8)).toBe(480);
    expect(hoursToMinutes(7.5)).toBe(450);
    expect(minutesToHours(450)).toBe(7.5);
  });

  it('round-trips without drift', () => {
    for (const hours of [6, 7.5, 8, 9.25]) {
      expect(minutesToHours(hoursToMinutes(hours))).toBe(hours);
    }
  });

  it('accepts a blank as unset', () => {
    const result = parse('');
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBeUndefined();
  });

  it('refuses more hours than a day has', () => {
    expect(parse('25').success).toBe(false);
    expect(parse('24').success).toBe(true);
  });
});
