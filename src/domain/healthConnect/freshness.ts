const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const WEIGHT_MAX_AGE_DAYS = 7;

/** Local midnight before `now`, as a timestamp. */
export function startOfLocalDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Weight moves slowly, so a week-old reading is still worth offering. */
export function isWeightUsable(recordedAt: number | null, now: number): boolean {
  if (recordedAt === null) {
    return false;
  }
  return now - recordedAt <= WEIGHT_MAX_AGE_DAYS * DAY_MS;
}

/**
 * Only prefill when the reading is recent and newer than the last check-in.
 * If the user weighed themselves in the app more recently than the scale
 * synced, their own number is the better starting point — their data wins.
 */
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
