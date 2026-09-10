/** 72 → "72.0". Always one decimal so a column of weights lines up. */
export const formatWeight = (kg: number): string => kg.toFixed(1);

/** 72 → "72.0 kg" */
export const formatWeightWithUnit = (kg: number): string =>
  `${formatWeight(kg)} kg`;

/** 0.5 → "0.5", 1 → "1.0". Magnitude only; the caller supplies the arrow. */
export const formatDelta = (kg: number): string => Math.abs(kg).toFixed(1);

/** 8421 → "8,421" */
export const formatSteps = (steps: number): string =>
  steps.toLocaleString('en-US');

/** 440 → "7h 20m" */
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

/** 480 → "8h" — goal denominators drop a zero minute count. */
export const formatDurationShort = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
};

/** 2100 → "2.1 L" */
export const formatWater = (ml: number): string => `${(ml / 1000).toFixed(1)} L`;

export const formatBmi = (bmi: number): string => bmi.toFixed(1);

// Dates ---------------------------------------------------------------------

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** 8:12 AM */
export const formatTime = (timestamp: number): string => {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
};

/**
 * "Today, 8 Oct" for today, otherwise "Wed, 8 Oct". `now` is injected so the
 * function stays pure and testable.
 */
export const formatRowDate = (timestamp: number, now: number = Date.now()): string => {
  const d = new Date(timestamp);
  const day = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return isSameDay(d, new Date(now))
    ? `Today, ${day}`
    : `${DAYS[d.getDay()]}, ${day}`;
};

/** "Wednesday, 8 October · 8:12 PM" — the detail screen's subtitle. */
export const formatLongDateTime = (timestamp: number): string => {
  const d = new Date(timestamp);
  const weekday = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ][d.getDay()];
  return `${weekday}, ${d.getDate()} ${MONTHS[d.getMonth()]} · ${formatTime(timestamp)}`;
};

/** "TUESDAY, 8 OCTOBER" — the dashboard header overline. */
export const formatHeaderDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  const weekday = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ][d.getDay()];
  return `${weekday}, ${d.getDate()} ${MONTHS[d.getMonth()]}`.toUpperCase();
};

/** "October 2025" — the history month heading. */
export const formatMonthTitle = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** Stable key for grouping entries into months. */
export const monthKey = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}`;
};

/**
 * Stable key for grouping entries into calendar days — "2026-09-08".
 *
 * Local calendar, via the same `Date` getters `monthKey` uses. Deliberately
 * NOT `toISOString()`: a check-in saved at 00:30 local sits on the previous
 * UTC day, so a UTC key would file it under yesterday. Zero-padded, unlike
 * `monthKey`, so the string also sorts.
 */
export const dayKey = (timestamp: number): string => {
  const d = new Date(timestamp);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * "Wed, 8 Sep" — the history day heading. Gains the year ("Wed, 8 Sep 2025")
 * only when it is not the current one, so recent days stay short.
 *
 * `now` is injected so the function stays pure and testable, matching
 * `formatRowDate`. Returned in mixed case: callers that want the uppercase
 * overline look apply `textTransform`, which leaves the string a screen
 * reader sees intact.
 */
export const formatDayTitle = (
  timestamp: number,
  now: number = Date.now(),
): string => {
  const d = new Date(timestamp);
  const label = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear()
    ? label
    : `${label} ${d.getFullYear()}`;
};

/** "15 September" — "Set 15 September" in Settings. */
export const formatShortDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
