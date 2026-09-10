import {
  decideDeepLink,
  isStashExpired,
  parseDeepLink,
  STASH_TTL_MS,
  type DeepLinkContext,
} from '@/navigation/deepLinks';

describe('parseDeepLink', () => {
  it('parses healthtracker://checkin/:id', () => {
    expect(parseDeepLink('healthtracker://checkin/123')).toEqual({
      kind: 'checkin',
      id: '123',
    });
  });

  it('accepts local (uuid) ids', () => {
    const id = 'c1b2e3f4-0000-4000-8000-000000000000';
    expect(parseDeepLink(`healthtracker://checkin/${id}`)).toEqual({
      kind: 'checkin',
      id,
    });
  });

  it('tolerates a trailing slash and the triple-slash form', () => {
    expect(parseDeepLink('healthtracker://checkin/123/')?.id).toBe('123');
    expect(parseDeepLink('healthtracker:///checkin/123')?.id).toBe('123');
  });

  it('rejects other hosts, schemes, and empty ids', () => {
    expect(parseDeepLink('healthtracker://profile/123')).toBeNull();
    expect(parseDeepLink('https://example.com/checkin/123')).toBeNull();
    expect(parseDeepLink('healthtracker://checkin/')).toBeNull();
    expect(parseDeepLink('healthtracker://checkin')).toBeNull();
    expect(parseDeepLink('')).toBeNull();
  });

  it('rejects ids with extra path segments', () => {
    expect(parseDeepLink('healthtracker://checkin/123/edit')).toBeNull();
  });
});

/** One case per row of the auth matrix in the session plan (spec §3.8). */
describe('decideDeepLink', () => {
  const CHECKIN = 'healthtracker://checkin/seed_7';

  const context = (over: Partial<DeepLinkContext> = {}): DeepLinkContext => ({
    hasSession: true,
    profileComplete: true,
    checkInsLoaded: true,
    checkInExists: id => id === 'seed_7',
    ...over,
  });

  it('opens the check-in when signed in and onboarded', () => {
    expect(decideDeepLink(CHECKIN, context())).toEqual({
      action: 'open',
      target: { kind: 'checkin', id: 'seed_7' },
    });
  });

  it('stashes while signed out', () => {
    expect(decideDeepLink(CHECKIN, context({ hasSession: false }))).toEqual({
      action: 'stash',
      url: CHECKIN,
    });
  });

  it('stashes while onboarding is unfinished, rather than interrupting it', () => {
    expect(decideDeepLink(CHECKIN, context({ profileComplete: false }))).toEqual({
      action: 'stash',
      url: CHECKIN,
    });
  });

  it('sends an id that no longer resolves to the not-found screen', () => {
    expect(decideDeepLink('healthtracker://checkin/gone', context())).toEqual({
      action: 'notFound',
      id: 'gone',
    });
  });

  it('ignores a URL that was never a check-in link', () => {
    expect(decideDeepLink('healthtracker://profile/1', context())).toEqual({
      action: 'ignore',
    });
    expect(decideDeepLink('https://example.com/checkin/1', context())).toEqual({
      action: 'ignore',
    });
  });

  it('ignores a malformed link while signed out instead of stashing it', () => {
    // Otherwise the user signs in only to be shown a check-in they never
    // asked for. Parsing deliberately happens before the auth gate.
    expect(
      decideDeepLink('healthtracker://profile/1', context({ hasSession: false })),
    ).toEqual({ action: 'ignore' });
  });

  it('resolves the id against real data, not just the URL shape', () => {
    const noData = context({ checkInExists: () => false });
    expect(decideDeepLink(CHECKIN, noData).action).toBe('notFound');
  });

  it('waits rather than claiming a check-in is gone before the list arrives', () => {
    // At cold start the link races the first GET /checkins. Answering "no
    // longer exists" there is the most confusing possible wrong answer.
    const stillLoading = context({
      checkInsLoaded: false,
      checkInExists: () => false,
    });
    expect(decideDeepLink(CHECKIN, stillLoading)).toEqual({
      action: 'stash',
      url: CHECKIN,
    });
  });

  it('still ignores a malformed link while the list is loading', () => {
    expect(
      decideDeepLink('healthtracker://profile/1', context({ checkInsLoaded: false })),
    ).toEqual({ action: 'ignore' });
  });
});

describe('isStashExpired', () => {
  const stashedAt = 1_000_000;

  it('keeps a link stashed moments ago', () => {
    expect(isStashExpired(stashedAt, stashedAt + 1_000)).toBe(false);
  });

  it('keeps it right up to the TTL', () => {
    expect(isStashExpired(stashedAt, stashedAt + STASH_TTL_MS)).toBe(false);
  });

  it('drops it past the TTL', () => {
    expect(isStashExpired(stashedAt, stashedAt + STASH_TTL_MS + 1)).toBe(true);
  });
});
