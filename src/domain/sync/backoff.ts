export const MAX_ATTEMPTS = 6;

const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60 * 1000;

export function nextDelayMs(attempts: number, random: number = Math.random()): number {
  const window = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts), MAX_DELAY_MS);
  return Math.round(window * (0.5 + random * 0.5));
}

export function canRetry(attempts: number): boolean {
  return attempts < MAX_ATTEMPTS;
}
