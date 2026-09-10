import type {
  CheckIn,
  CheckInSources,
  FieldSource,
  Mood,
  SourcedField,
} from '@/domain/checkins/types';
import type { ProfileState } from '@/store/profile/profileSlice';

/**
 * The API's optional fields are `.optional()`, which Zod satisfies with
 * `undefined` and nothing else — a literal `null` fails the whole request, not
 * just that field. So "absent" has to mean an absent key. Nothing is lost:
 * the server writes `input.x ?? null` either way.
 *
 * Shallow on purpose — `sources` must keep all five keys.
 */
const withoutNulls = (
  body: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== null && value !== undefined),
  );

type AuthUserDto = { id: string; email: string };

export type AuthResponseDto = {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
};

/**
 * Signup issues no tokens — it parks the details until the code is verified.
 * The email comes back so the verify screen can name the address.
 */
export type SignupResponseDto = { email: string };

export type VerifyOtpBody = { email: string; code: string };

/** `POST /auth/refresh` rotates: the token sent is dead once this returns. */
export type RefreshResponseDto = {
  accessToken: string;
  refreshToken: string;
};

export type ProfileDto = {
  name: string | null;
  baselineWeight: number;
  height: number | null;
  stepGoal: number | null;
  waterGoal: number | null;
  /** Minutes, matching `sleepMinutes` on a check-in. */
  sleepGoal: number | null;
  targetWeight: number | null;
  updatedAt: string;
};

/** The fields a profile response can fill in. `isComplete` is ours alone. */
export type ProfilePatch = Pick<
  ProfileState,
  | 'name'
  | 'baselineWeightKg'
  | 'heightCm'
  | 'stepGoal'
  | 'waterGoalMl'
  | 'sleepGoalMinutes'
  | 'targetWeightKg'
>;

export function toProfilePatch(dto: ProfileDto): ProfilePatch {
  return {
    name: dto.name ?? '',
    baselineWeightKg: dto.baselineWeight,
    heightCm: dto.height,
    stepGoal: dto.stepGoal,
    waterGoalMl: dto.waterGoal,
    sleepGoalMinutes: dto.sleepGoal ?? null,
    targetWeightKg: dto.targetWeight,
  };
}

/**
 * `PUT /profile` is a full replace: any field left out is written as null, not
 * preserved. So this always sends all six — treating it as a partial update
 * silently blanks the user's goals.
 */
export function toProfileBody(
  profile: ProfilePatch & { baselineWeightKg: number },
): Record<string, unknown> {
  const name = profile.name.trim();
  return withoutNulls({
    // The server requires 1–100 chars when present; an empty name is absent —
    // and absent means the key is gone, not set to null (see withoutNulls).
    name: name === '' ? null : name,
    baselineWeight: profile.baselineWeightKg,
    height: profile.heightCm,
    stepGoal: profile.stepGoal,
    waterGoal: profile.waterGoalMl,
    sleepGoal: profile.sleepGoalMinutes,
    targetWeight: profile.targetWeightKg,
  });
}

/** The server spells sources in snake_case and requires all five keys. */
type ServerSource = 'manual' | 'health_connect';

export type CheckInDto = {
  id: string;
  /**
   * The id this device gave the check-in, echoed back. Absent on older rows,
   * so `id` remains the identity — this only exists to recognise a row this
   * device created but never learned the server id for, because the POST
   * landed and its response did not.
   */
  clientId?: string | null;
  weightKg: number;
  heightCm: number | null;
  sleepMinutes: number | null;
  steps: number | null;
  waterMl: number | null;
  mood: number | null;
  notes: string | null;
  sources: Record<'weight' | 'height' | 'sleep' | 'steps' | 'water', ServerSource>;
  /** When the user recorded it — this is our `createdAt`. */
  recordedAt: string;
  /** Row-insert time. Deliberately unused — see `toCheckIn`. */
  createdAt: string;
  updatedAt: string;
};

const SOURCED_FIELDS: readonly SourcedField[] = ['weight', 'steps', 'sleep', 'water'];

const toDomainSource = (value: ServerSource | undefined): FieldSource | undefined => {
  if (value === 'health_connect') {
    return 'healthConnect';
  }
  return value === 'manual' ? 'manual' : undefined;
};

const toServerSource = (value: FieldSource | undefined): ServerSource =>
  value === 'healthConnect' ? 'health_connect' : 'manual';

/** Only 1–5 is a mood; anything else is treated as unset rather than trusted. */
const toMood = (value: number | null): Mood | null => {
  if (value === null || !Number.isInteger(value) || value < 1 || value > 5) {
    return null;
  }
  return value as Mood;
};

export function toCheckIn(dto: CheckInDto): CheckIn {
  const sources: CheckInSources = {};
  for (const field of SOURCED_FIELDS) {
    const source = toDomainSource(dto.sources?.[field]);
    if (source !== undefined) {
      sources[field] = source;
    }
  }

  return {
    id: dto.id,
    // `recordedAt`, not the server's `createdAt`: ours is when the user took
    // the reading, and row-insert time would reorder history the moment
    // something was entered late.
    createdAt: Date.parse(dto.recordedAt),
    weightKg: dto.weightKg,
    heightCm: dto.heightCm,
    steps: dto.steps,
    sleepMinutes: dto.sleepMinutes,
    waterMl: dto.waterMl,
    mood: toMood(dto.mood),
    notes: dto.notes ?? '',
    sources,
  };
}

export function toCheckInBody(checkIn: CheckIn): Record<string, unknown> {
  return withoutNulls({
    // What makes POST safe to repeat: a dropped response is indistinguishable
    // from a dropped request, so the server upserts on this id and a retry
    // lands on the same row instead of duplicating the check-in.
    clientId: checkIn.id,
    weightKg: checkIn.weightKg,
    heightCm: checkIn.heightCm,
    sleepMinutes: checkIn.sleepMinutes,
    steps: checkIn.steps,
    waterMl: checkIn.waterMl,
    mood: checkIn.mood,
    // An empty note is an absent note. `withoutNulls` drops the key, and the
    // server stores null for it — sending the null outright is what fails.
    notes: checkIn.notes.trim() === '' ? null : checkIn.notes,
    // All five keys are required even when the value is absent. Height is
    // profile data rather than something measured at check-in time, so it has
    // no real source; `manual` understates device involvement, which is the
    // safer direction to be wrong in.
    sources: {
      weight: toServerSource(checkIn.sources.weight),
      height: 'manual' satisfies ServerSource,
      sleep: toServerSource(checkIn.sources.sleep),
      steps: toServerSource(checkIn.sources.steps),
      water: toServerSource(checkIn.sources.water),
    },
    // Must carry a zone or the server rejects it; toISOString always ends in Z.
    recordedAt: new Date(checkIn.createdAt).toISOString(),
  });
}
