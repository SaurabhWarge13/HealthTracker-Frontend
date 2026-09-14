import type { DeepLinkTarget } from '@/types/navigation';

export const STASH_TTL_MS = 5 * 60 * 1000;

const CHECKIN_URL = /^healthtracker:\/\/\/?checkin\/([^/?#]+)\/?$/i;

export function buildCheckInLink(id: string): string {
  return `healthtracker://checkin/${encodeURIComponent(id)}`;
}

export function parseDeepLink(url: string): DeepLinkTarget | null {
  const match = CHECKIN_URL.exec(url.trim());
  if (!match) {
    return null;
  }
  const id = decodeURIComponent(match[1]);
  return id ? { kind: 'checkin', id } : null;
}

export type DeepLinkDecision =
  | { action: 'open'; target: DeepLinkTarget }
  | { action: 'notFound'; id: string }
  | { action: 'stash'; url: string }
  | { action: 'ignore' };

export type DeepLinkContext = {
  hasSession: boolean;
  profileComplete: boolean;
  checkInsLoaded: boolean;
  checkInExists: (id: string) => boolean;
};

export function decideDeepLink(
  url: string,
  context: DeepLinkContext,
): DeepLinkDecision {
  const target = parseDeepLink(url);
  if (target === null) {
    return { action: 'ignore' };
  }

  if (
    !context.hasSession ||
    !context.profileComplete ||
    !context.checkInsLoaded
  ) {
    return { action: 'stash', url };
  }

  return context.checkInExists(target.id)
    ? { action: 'open', target }
    : { action: 'notFound', id: target.id };
}

export function isStashExpired(stashedAt: number, now: number): boolean {
  return now - stashedAt > STASH_TTL_MS;
}
