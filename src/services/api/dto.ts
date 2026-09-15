import type {
  CheckIn,
  CheckInSources,
  FieldSource,
  Mood,
  SourcedField,
} from '@/domain/checkins/types';
import type { ProfileState } from '@/store/profile/profileSlice';

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
  /**
   * The profile as it exists on the server at sign-in, so the client never has
   * to make a second request to learn whether to show onboarding.
   *
   * - object    — hydrate it
   * - `null`    — the server has no profile for this user
   * - `undefined` — the backend predates this field; fall back to `GET /profile`
   */
  profile?: ProfileDto | null;
};

export type SignupResponseDto = { email: string };

export type VerifyOtpBody = { email: string; code: string };

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
  sleepGoal: number | null;
  targetWeight: number | null;
  updatedAt: string;
};

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

export function toProfileBody(
  profile: ProfilePatch & { baselineWeightKg: number },
): Record<string, unknown> {
  const name = profile.name.trim();
  return withoutNulls({
    name: name === '' ? null : name,
    baselineWeight: profile.baselineWeightKg,
    height: profile.heightCm,
    stepGoal: profile.stepGoal,
    waterGoal: profile.waterGoalMl,
    sleepGoal: profile.sleepGoalMinutes,
    targetWeight: profile.targetWeightKg,
  });
}

type ServerSource = 'manual' | 'health_connect';

export type CheckInDto = {
  id: string;
  clientId?: string | null;
  weightKg: number;
  heightCm: number | null;
  sleepMinutes: number | null;
  steps: number | null;
  waterMl: number | null;
  mood: number | null;
  notes: string | null;
  sources: Record<'weight' | 'height' | 'sleep' | 'steps' | 'water', ServerSource>;
  recordedAt: string;
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
    clientId: checkIn.id,
    weightKg: checkIn.weightKg,
    heightCm: checkIn.heightCm,
    sleepMinutes: checkIn.sleepMinutes,
    steps: checkIn.steps,
    waterMl: checkIn.waterMl,
    mood: checkIn.mood,
    notes: checkIn.notes.trim() === '' ? null : checkIn.notes,
    sources: {
      weight: toServerSource(checkIn.sources.weight),
      height: 'manual' satisfies ServerSource,
      sleep: toServerSource(checkIn.sources.sleep),
      steps: toServerSource(checkIn.sources.steps),
      water: toServerSource(checkIn.sources.water),
    },
    recordedAt: new Date(checkIn.createdAt).toISOString(),
  });
}
