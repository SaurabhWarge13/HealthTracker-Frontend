import { z } from 'zod';

export const WEIGHT_MIN_KG = 25;
export const WEIGHT_MAX_KG = 300;
export const HEIGHT_MIN_CM = 50;
export const HEIGHT_MAX_CM = 260;
export const STEP_GOAL_MAX = 100_000;
export const WATER_GOAL_MAX_ML = 10_000;
export const SLEEP_GOAL_MAX_MINUTES = 24 * 60;
export const NAME_MAX_LENGTH = 40;

export const parseDecimalInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const normalized = /,\d{1,2}$/.test(trimmed)
    ? trimmed.replace(/[\s.]/g, '').replace(',', '.')
    : trimmed.replace(/[\s,]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

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

export const heightField = requiredNumber(
  parseIntegerInput,
  'Enter your height',
).pipe(
  z
    .number()
    .min(HEIGHT_MIN_CM, `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`)
    .max(HEIGHT_MAX_CM, `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`),
);

export const optionalHeightField = optionalNumber(parseIntegerInput).pipe(
  z
    .number()
    .min(HEIGHT_MIN_CM, `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`)
    .max(HEIGHT_MAX_CM, `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`)
    .optional(),
);

export const baselineSchema = z.object({
  weight: weightField,
  height: heightField,
});

export type BaselineValues = z.input<typeof baselineSchema>;
export type BaselinePayload = z.output<typeof baselineSchema>;

export const goalOrNull = (value: number | undefined): number | null =>
  value === undefined || value === 0 ? null : value;

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

export const goalsSchema = z.object({
  stepGoal: optionalStepGoalField,
  waterGoalLitres: optionalWaterGoalLitresField,
  sleepGoalHours: optionalSleepGoalHoursField,
  targetWeight: optionalTargetWeightField,
});

export type GoalsValues = z.input<typeof goalsSchema>;
export type GoalsPayload = z.output<typeof goalsSchema>;

export const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .max(NAME_MAX_LENGTH, `Keep it under ${NAME_MAX_LENGTH} characters.`),
});

export type NameValues = z.input<typeof nameSchema>;
