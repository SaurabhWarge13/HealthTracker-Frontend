import type { RecordResult } from 'react-native-health-connect';
import { startOfLocalDay } from '@/domain/healthConnect/freshness';
import type {
  FieldAvailability,
  HealthConnectField,
  TodayReadings,
} from '@/store/healthConnect/healthConnectSlice';

/**
 * One entry per field. `null` means we never read it — no permission — as
 * opposed to `[]`, which means we read and the device had nothing.
 */
export type RawTodayRecords = {
  weight: RecordResult<'Weight'>[] | null;
  height: RecordResult<'Height'>[] | null;
  steps: RecordResult<'Steps'>[] | null;
  sleep: RecordResult<'SleepSession'>[] | null;
  water: RecordResult<'Hydration'>[] | null;
};

export type MappedReadings = {
  today: TodayReadings;
  availability: Record<HealthConnectField, FieldAvailability>;
};

const MINUTE_MS = 60 * 1000;

const time = (iso: string): number => new Date(iso).getTime();

/** Permission denied, granted-but-empty, and got-a-value are three answers. */
const availabilityOf = (
  records: unknown[] | null,
  hasValue: boolean,
): FieldAvailability => {
  if (records === null) {
    return 'PERMISSION_DENIED';
  }
  return hasValue ? 'AVAILABLE' : 'NO_DATA';
};

/** Newest record wins for the slow-moving measures. */
function latestByTime<T extends { time: string }>(records: T[] | null): T | null {
  if (records === null || records.length === 0) {
    return null;
  }
  return records.reduce((newest, record) =>
    time(record.time) > time(newest.time) ? record : newest,
  );
}

function sumSteps(records: RecordResult<'Steps'>[] | null): number | null {
  if (records === null || records.length === 0) {
    return null;
  }
  // Several apps can each write part of the day; the day's total is the sum.
  const total = records.reduce((sum, record) => sum + record.count, 0);
  return Math.round(total);
}

function sumWaterMl(records: RecordResult<'Hydration'>[] | null): number | null {
  if (records === null || records.length === 0) {
    return null;
  }
  const total = records.reduce((sum, record) => sum + record.volume.inMilliliters, 0);
  return Math.round(total);
}

/**
 * Sleep for "today" means the night that ENDED today — someone who
 * woke at 7 AM slept from 11 PM yesterday, and reporting zero until they go
 * to bed again would be useless. Sessions still in progress are ignored.
 */
function sumSleepMinutes(
  records: RecordResult<'SleepSession'>[] | null,
  now: number,
): number | null {
  if (records === null) {
    return null;
  }
  const dayStart = startOfLocalDay(now);
  const endedToday = records.filter(record => {
    const end = time(record.endTime);
    return end >= dayStart && end <= now;
  });
  if (endedToday.length === 0) {
    return null;
  }
  const totalMs = endedToday.reduce(
    (sum, record) => sum + Math.max(0, time(record.endTime) - time(record.startTime)),
    0,
  );
  const minutes = Math.round(totalMs / MINUTE_MS);
  return minutes > 0 ? minutes : null;
}

export function mapTodayReadings(raw: RawTodayRecords, now: number): MappedReadings {
  const weightRecord = latestByTime(raw.weight);
  const heightRecord = latestByTime(raw.height);

  const steps = sumSteps(raw.steps);
  const waterMl = sumWaterMl(raw.water);
  const sleepMinutes = sumSleepMinutes(raw.sleep, now);

  const weightKg =
    weightRecord === null
      ? null
      : Math.round(weightRecord.weight.inKilograms * 10) / 10;
  const heightCm =
    heightRecord === null ? null : Math.round(heightRecord.height.inMeters * 100);

  return {
    today: {
      steps,
      sleepMinutes,
      waterMl,
      weightKg,
      weightRecordedAt: weightRecord === null ? null : time(weightRecord.time),
      heightCm,
      heightRecordedAt: heightRecord === null ? null : time(heightRecord.time),
      // When we read, not when the device recorded — two different facts.
      syncedAt: now,
    },
    availability: {
      weight: availabilityOf(raw.weight, weightKg !== null),
      height: availabilityOf(raw.height, heightCm !== null),
      steps: availabilityOf(raw.steps, steps !== null),
      sleep: availabilityOf(raw.sleep, sleepMinutes !== null),
      water: availabilityOf(raw.water, waterMl !== null),
    },
  };
}
