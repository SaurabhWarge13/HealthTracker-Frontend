import { z } from 'zod';
import {
  optionalHeightField,
  parseDecimalInput,
  parseIntegerInput,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from '@/domain/profile/validation';

export const STEPS_MAX = 100_000;
export const SLEEP_MAX_MINUTES = 24 * 60;
export const WATER_MAX_ML = 10_000;
export const NOTES_MAX_LENGTH = 500;

const RANGE_MESSAGE = `That looks out of range. Enter a weight between ${WEIGHT_MIN_KG.toFixed(
  1,
)} and ${WEIGHT_MAX_KG.toFixed(1)} kg.`;

const SLEEP_RANGE_MESSAGE = `Enter sleep between 0 and ${
  SLEEP_MAX_MINUTES / 60
} hours.`;

/**
 * "7h 20m", "7h", "7:20" and "7.5" all mean roughly the same thing to a person
 * typing quickly, so accept them all and store minutes.
 *
 * A bare number is always hours, never minutes: reading large bare numbers as
 * minutes made "26" a silently-accepted 26-minute night instead of the range
 * error a person typing hours expects.
 */
export const parseSleepInput = (value: string): number | null => {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '') {
    return null;
  }

  const hm = /^(\d+)\s*h\s*(\d+)?\s*m?$/.exec(trimmed);
  if (hm) {
    return Number(hm[1]) * 60 + Number(hm[2] ?? 0);
  }

  const colon = /^(\d+):(\d{1,2})$/.exec(trimmed);
  if (colon) {
    return Number(colon[1]) * 60 + Number(colon[2]);
  }

  const bare = parseDecimalInput(trimmed);
  if (bare === null) {
    return null;
  }
  return Math.round(bare * 60);
};

const optional = (parse: (value: string) => number | null) =>
  z
    .string()
    .transform(value => (value.trim() === '' ? undefined : parse(value)))
    .pipe(z.number({ message: 'Enter a number' }).optional());

export const checkInSchema = z.object({
  weight: z
    .string()
    .transform(value => parseDecimalInput(value))
    .pipe(
      z
        .number({ message: 'Enter your weight' })
        .min(WEIGHT_MIN_KG, RANGE_MESSAGE)
        .max(WEIGHT_MAX_KG, RANGE_MESSAGE),
    ),
  steps: optional(parseIntegerInput).pipe(
    z
      .number()
      .min(0, 'Steps cannot be negative.')
      .max(STEPS_MAX, `Enter a step count under ${STEPS_MAX.toLocaleString()}.`)
      .optional(),
  ),
  sleep: optional(parseSleepInput).pipe(
    z
      .number()
      .min(0, SLEEP_RANGE_MESSAGE)
      .max(SLEEP_MAX_MINUTES, SLEEP_RANGE_MESSAGE)
      .optional(),
  ),
  /** Entered in litres, stored as integer millilitres. */
  water: optional(parseDecimalInput).pipe(
    z
      .number()
      .min(0, 'Water cannot be negative.')
      .max(WATER_MAX_ML / 1000, `Enter an amount under ${WATER_MAX_ML / 1000} L.`)
      .optional(),
  ),
  /**
   * Optional here even though the profile now requires it: this is the height
   * *at the time of the check-in*, and an older entry may not have one.
   */
  height: optionalHeightField,
  notes: z.string().max(NOTES_MAX_LENGTH, 'That is a very long note.'),
});

export type CheckInValues = z.input<typeof checkInSchema>;
export type CheckInPayload = z.output<typeof checkInSchema>;
