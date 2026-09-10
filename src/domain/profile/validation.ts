import { z } from 'zod';

export const WEIGHT_MIN_KG = 25;
export const WEIGHT_MAX_KG = 300;
export const HEIGHT_MIN_CM = 50;
export const HEIGHT_MAX_CM = 260;
export const STEP_GOAL_MAX = 100_000;
export const WATER_GOAL_MAX_ML = 10_000;
/** Minutes, so it lines up with `sleepMinutes` on a check-in. A day's cap. */
export const SLEEP_GOAL_MAX_MINUTES = 24 * 60;
export const NAME_MAX_LENGTH = 40;

/**
 * Accepts what a real keyboard produces: comma decimals (`72,4`), thousands
 * separators (`8,000` / `8 000`), stray spaces. Returns null for anything
 * that is not a number, so callers can tell "empty" from "nonsense".
 */
export const parseDecimalInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  // A comma is a decimal separator when it is followed by 1–2 digits at the
  // end ("72,4"); otherwise it is a thousands separator ("8,000").
  const normalized = /,\d{1,2}$/.test(trimmed)
    ? trimmed.replace(/[\s.]/g, '').replace(',', '.')
    : trimmed.replace(/[\s,]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Same, but rejects anything with a fractional part (steps, height). */
export const parseIntegerInput = (value: string): number | null => {
  const parsed = parseDecimalInput(value);
  if (parsed === null || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
};

export const litresToMl = (litres: number): number => Math.round(litres * 1000);
export const mlToLitres = (ml: number): number => ml / 1000;

export const hoursToMinutes = (hours: number): number => Math.round(hours * 60);
export const minutesToHours = (minutes: number): number => minutes / 60;

/** Turns a text field into a number for zod, keeping "" as undefined. */
const optionalNumber = (parse: (value: string) => number | null) =>
  z
    .string()
    .transform(value => (value.trim() === '' ? undefined : parse(value)))
    .pipe(z.number({ message: 'Enter a number' }).optional());

const requiredNumber = (parse: (value: string) => number | null, message: string) =>
  z
    .string()
    .transform(value => parse(value))
    .pipe(z.number({ message }));

export const weightField = requiredNumber(
  parseDecimalInput,
  'Enter your weight',
).pipe(
  z
    .number()
    .min(WEIGHT_MIN_KG, `That looks out of range. Enter a weight between ${WEIGHT_MIN_KG.toFixed(1)} and ${WEIGHT_MAX_KG.toFixed(1)} kg.`)
    .max(WEIGHT_MAX_KG, `That looks out of range. Enter a weight between ${WEIGHT_MIN_KG.toFixed(1)} and ${WEIGHT_MAX_KG.toFixed(1)} kg.`),
);

/**
 * Height on the profile. Required: it is asked for once during onboarding and
 * cannot be blanked out afterwards, so BMI is answerable for anyone who set
 * up on this build.
 *
 * A profile that arrives from the server can still carry no height — the
 * store, the DTO and the BMI tile all keep their null paths for that.
 */
export const heightField = requiredNumber(
  parseIntegerInput,
  'Enter your height',
).pipe(
  z
    .number()
    .min(HEIGHT_MIN_CM, `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`)
    .max(HEIGHT_MAX_CM, `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`),
);

/**
 * The check-in *snapshot* of height, which records whatever was known at the
 * time and may legitimately be nothing. Used by `checkInSchema`.
 */
export const optionalHeightField = optionalNumber(parseIntegerInput).pipe(
  z
    .number()
    .min(HEIGHT_MIN_CM, `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`)
    .max(HEIGHT_MAX_CM, `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`)
    .optional(),
);

/** Step 3 — weight and height are both required before Continue enables. */
export const baselineSchema = z.object({
  weight: weightField,
  height: heightField,
});

export type BaselineValues = z.input<typeof baselineSchema>;
export type BaselinePayload = z.output<typeof baselineSchema>;

/**
 * A goal the user did not set.
 *
 * Blank and zero mean the same thing — "don't measure me against anything" —
 * and both have to become `null`, because that is what every unset goal is
 * throughout the app. Sending a literal `0` instead is not a cosmetic
 * difference: the API types every goal as `.positive()`, so a zero is rejected
 * with a 400, `pushProfile` swallows it, and `pendingSync` never clears again.
 * That takes `GET /profile` down with it, since `profileHydrated` refuses to
 * overwrite a profile with unsent edits.
 */
export const goalOrNull = (value: number | undefined): number | null =>
  value === undefined || value === 0 ? null : value;

/**
 * Each goal as its own field, so Settings can edit one at a time against the
 * exact rule onboarding used. Two copies of a range is one too many.
 */
export const optionalStepGoalField = optionalNumber(parseIntegerInput).pipe(
  z
    .number()
    .min(0, 'Enter a positive number of steps.')
    .max(STEP_GOAL_MAX, `Enter a step goal under ${STEP_GOAL_MAX.toLocaleString()}.`)
    .optional(),
);

export const optionalWaterGoalLitresField = optionalNumber(parseDecimalInput).pipe(
  z
    .number()
    .min(0, 'Enter a positive amount.')
    .max(WATER_GOAL_MAX_ML / 1000, `Enter a water goal under ${WATER_GOAL_MAX_ML / 1000} L.`)
    .optional(),
);

/**
 * Entered in hours — "8", "7.5" — and stored in minutes, the same split water
 * already uses for litres and millilitres. Minutes is what a check-in records,
 * so the comparison the goal exists for needs no conversion.
 */
export const optionalSleepGoalHoursField = optionalNumber(parseDecimalInput).pipe(
  z
    .number()
    .min(0, 'Enter a positive number of hours.')
    .max(SLEEP_GOAL_MAX_MINUTES / 60, `Enter a sleep goal under ${SLEEP_GOAL_MAX_MINUTES / 60} hours.`)
    .optional(),
);

export const optionalTargetWeightField = optionalNumber(parseDecimalInput).pipe(
  z
    .number()
    .min(WEIGHT_MIN_KG, `Enter a target between ${WEIGHT_MIN_KG.toFixed(1)} and ${WEIGHT_MAX_KG.toFixed(1)} kg.`)
    .max(WEIGHT_MAX_KG, `Enter a target between ${WEIGHT_MIN_KG.toFixed(1)} and ${WEIGHT_MAX_KG.toFixed(1)} kg.`)
    .optional(),
);

/** Step 4 — every goal is optional; a target may sit above or below today. */
export const goalsSchema = z.object({
  stepGoal: optionalStepGoalField,
  waterGoalLitres: optionalWaterGoalLitresField,
  sleepGoalHours: optionalSleepGoalHoursField,
  targetWeight: optionalTargetWeightField,
});

export type GoalsValues = z.input<typeof goalsSchema>;
export type GoalsPayload = z.output<typeof goalsSchema>;

/** Step 1 — a first name is plenty, and it may be left blank. */
export const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .max(NAME_MAX_LENGTH, `Keep it under ${NAME_MAX_LENGTH} characters.`),
});

export type NameValues = z.input<typeof nameSchema>;
