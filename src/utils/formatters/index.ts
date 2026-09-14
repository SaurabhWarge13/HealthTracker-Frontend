export const formatWeight = (kg: number): string => kg.toFixed(1);

export const formatWeightWithUnit = (kg: number): string =>
  `${formatWeight(kg)} kg`;

export const formatDelta = (kg: number): string => Math.abs(kg).toFixed(1);

export const formatSteps = (steps: number): string =>
  steps.toLocaleString('en-US');

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

export const formatDurationShort = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
};

export const formatWater = (ml: number): string => `${(ml / 1000).toFixed(1)} L`;

export const formatBmi = (bmi: number): string => bmi.toFixed(1);

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

export const formatTime = (timestamp: number): string => {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
};

export const formatRowDate = (timestamp: number, now: number = Date.now()): string => {
  const d = new Date(timestamp);
  const day = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return isSameDay(d, new Date(now))
    ? `Today, ${day}`
    : `${DAYS[d.getDay()]}, ${day}`;
};

export const formatLongDateTime = (timestamp: number): string => {
  const d = new Date(timestamp);
  const weekday = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ][d.getDay()];
  return `${weekday}, ${d.getDate()} ${MONTHS[d.getMonth()]} · ${formatTime(timestamp)}`;
};

export const formatHeaderDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  const weekday = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ][d.getDay()];
  return `${weekday}, ${d.getDate()} ${MONTHS[d.getMonth()]}`.toUpperCase();
};

export const formatMonthTitle = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const monthKey = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}`;
};

export const dayKey = (timestamp: number): string => {
  const d = new Date(timestamp);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

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

export const formatShortDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
