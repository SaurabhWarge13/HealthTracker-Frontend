import type { DeepLinkTarget } from '@/types/navigation';

/**
 * A link stashed longer ago than this is dropped rather than replayed, so a
 * link tapped last week cannot spring open on the next sign-in.
 */
export const STASH_TTL_MS = 5 * 60 * 1000;

// healthtracker://checkin/<id>  — also tolerates a third slash and a
// trailing slash, which some launchers and mail clients add.
const CHECKIN_URL = /^healthtracker:\/\/\/?checkin\/([^/?#]+)\/?$/i;

/**
 * The outbound half of {@link parseDeepLink} — kept beside it so the URL
 * format is written down once and the two stay round-trippable.
 */
export function buildCheckInLink(id: string): string {
  return `healthtracker://checkin/${encodeURIComponent(id)}`;
}

/** Returns null for anything that isn't a check-in link. */
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
  /** A real check-in link whose entry is gone. */
  | { action: 'notFound'; id: string }
  /** Hold it until the user is signed in and onboarded. */
  | { action: 'stash'; url: string }
  /** Not ours, or not a check-in link. */
  | { action: 'ignore' };

export type DeepLinkContext = {
  hasSession: boolean;
  profileComplete: boolean;
  /**
   * Whether check-ins have been fetched at least once this session. Without
   * it, a link opened from a cold start races the first `GET /checkins` and
   * answers "no longer exists" for a check-in that is merely not downloaded.
   */
  checkInsLoaded: boolean;
  checkInExists: (id: string) => boolean;
};

/**
 * Parsing comes before the auth gate on purpose: a URL that was never a
 * check-in link is ignored rather than stashed, so `healthtracker://profile/1`
 * cannot make someone sign in only to be told a check-in is missing.
 */
export function decideDeepLink(
  url: string,
  context: DeepLinkContext,
): DeepLinkDecision {
  const target = parseDeepLink(url);
  if (target === null) {
    return { action: 'ignore' };
  }

  // A link waits for sign-in, onboarding and the first check-in fetch —
  // waiting a moment beats telling someone their data is gone.
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
