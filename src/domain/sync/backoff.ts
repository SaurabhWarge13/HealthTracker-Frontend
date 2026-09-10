/** After this many failures an op stops retrying and asks the user. */
export const MAX_ATTEMPTS = 6;

const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60 * 1000;

/**
 * Full jitter: a random point in [half, full] of the exponential window.
 * `random` is injected so the tests are not a coin toss.
 */
export function nextDelayMs(attempts: number, random: number = Math.random()): number {
  const window = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts), MAX_DELAY_MS);
  return Math.round(window * (0.5 + random * 0.5));
}

/** Whether another attempt is allowed at all. */
export function canRetry(attempts: number): boolean {
  return attempts < MAX_ATTEMPTS;
}
