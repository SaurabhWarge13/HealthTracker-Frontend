const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const WEIGHT_MAX_AGE_DAYS = 7;

export function startOfLocalDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isWeightUsable(recordedAt: number | null, now: number): boolean {
  if (recordedAt === null) {
    return false;
  }
  return now - recordedAt <= WEIGHT_MAX_AGE_DAYS * DAY_MS;
}

export function shouldPrefillWeight(
  hcRecordedAt: number | null,
  lastCheckInAt: number | null,
  now: number,
): boolean {
  if (!isWeightUsable(hcRecordedAt, now)) {
    return false;
  }
  if (lastCheckInAt === null) {
    return true;
  }
  return (hcRecordedAt as number) > lastCheckInAt;
}
