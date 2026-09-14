import {
  API_ERROR_CODES,
  authMessage,
  extractServerError,
  flattenFieldErrors,
  isRetryable,
  normalizeError,
  REFRESHABLE_CODES,
  userMessage,
  type ApiErrorKind,
} from '@/domain/api/errors';

const envelope = (status: number, code: string, message: string, fields?: unknown) => ({
  status,
  data: { error: fields === undefined ? { code, message } : { code, message, fields } },
});

describe('extractServerError', () => {
  it('reads the envelope', () => {
    expect(
      extractServerError({ error: { code: 'NO_TOKEN', message: 'Authorization header missing' } }),
    ).toEqual({ code: 'NO_TOKEN', message: 'Authorization header missing', fields: undefined });
  });

  it('returns null for anything that is not the envelope', () => {
    expect(extractServerError(undefined)).toBeNull();
    expect(extractServerError('Internal Server Error')).toBeNull();
    expect(extractServerError({ message: 'nope' })).toBeNull();
  });
});

describe('normalizeError — one case per API error code', () => {
  const cases: Array<[string, number, ApiErrorKind]> = [
    [API_ERROR_CODES.VALIDATION_ERROR, 400, 'validation'],
    [API_ERROR_CODES.NO_TOKEN, 401, 'sessionExpired'],
    [API_ERROR_CODES.INVALID_TOKEN, 401, 'sessionExpired'],
    [API_ERROR_CODES.INVALID_CREDENTIALS, 401, 'badCredentials'],
    [API_ERROR_CODES.INVALID_REFRESH_TOKEN, 401, 'sessionExpired'],
    [API_ERROR_CODES.EMAIL_TAKEN, 409, 'emailTaken'],
    [API_ERROR_CODES.INVALID_OTP, 400, 'validation'],
    [API_ERROR_CODES.NO_PENDING_SIGNUP, 400, 'validation'],
    [API_ERROR_CODES.NOT_FOUND, 404, 'notFound'],
    [API_ERROR_CODES.SIMULATED_FAILURE, 500, 'server'],
    [API_ERROR_CODES.INTERNAL_ERROR, 500, 'server'],
  ];

  it.each(cases)('%s → %s', (code, status, kind) => {
    const result = normalizeError(envelope(status, code, 'server wording'));
    expect(result.kind).toBe(kind);
    expect(result.code).toBe(code);
    expect(result.status).toBe(status);
  });

  it("prefers the server's own message over ours", () => {
    const result = normalizeError(
      envelope(401, API_ERROR_CODES.INVALID_CREDENTIALS, 'Email or password is incorrect'),
    );
    expect(result.message).toBe('Email or password is incorrect');
  });

  it('separates the three 401s, so a wrong password never looks like a dead session', () => {
    const bad = normalizeError(envelope(401, API_ERROR_CODES.INVALID_CREDENTIALS, 'x'));
    const dead = normalizeError(envelope(401, API_ERROR_CODES.INVALID_TOKEN, 'x'));
    expect(bad.kind).not.toBe(dead.kind);
  });
});

describe('normalizeError — no envelope', () => {
  it('falls back to the status', () => {
    expect(normalizeError({ status: 404, data: undefined }).kind).toBe('notFound');
    expect(normalizeError({ status: 400, data: 'plain text' }).kind).toBe('validation');
    expect(normalizeError({ status: 401, data: undefined }).kind).toBe('sessionExpired');
    expect(normalizeError({ status: 503, data: undefined }).kind).toBe('server');
  });

  it('is unknown for a status the API never emits', () => {
    expect(normalizeError({ status: 418, data: undefined }).kind).toBe('unknown');
  });

  it('handles junk without throwing', () => {
    expect(normalizeError(undefined).kind).toBe('unknown');
    expect(normalizeError('boom').kind).toBe('unknown');
    expect(normalizeError({ status: 'CUSTOM_ERROR', error: 'x' }).kind).toBe('unknown');
  });
});

describe('normalizeError — transport failures', () => {
  it('distinguishes offline from server-unreachable using connectivity', () => {
    const failed = { status: 'FETCH_ERROR', error: 'Network request failed' };
    expect(normalizeError(failed, { isOnline: false }).kind).toBe('offline');
    expect(normalizeError(failed, { isOnline: true }).kind).toBe('network');
    expect(normalizeError(failed).kind).toBe('network');
  });

  it('maps a timeout', () => {
    expect(normalizeError({ status: 'TIMEOUT_ERROR', error: 'timed out' }).kind).toBe(
      'timeout',
    );
  });

  it('treats an unparseable body as a server fault, keeping the real status', () => {
    const result = normalizeError({
      status: 'PARSING_ERROR',
      originalStatus: 502,
      data: '<html>',
      error: 'Unexpected token',
    });
    expect(result.kind).toBe('server');
    expect(result.status).toBe(502);
  });
});

describe('flattenFieldErrors', () => {
  it('reads a flat Zod issue array', () => {
    expect(
      flattenFieldErrors([
        { path: ['email'], message: 'Invalid email' },
        { path: ['password'], message: 'Too short' },
      ]),
    ).toEqual({ email: 'Invalid email', password: 'Too short' });
  });

  it('reads an issues-wrapped array', () => {
    expect(
      flattenFieldErrors({ issues: [{ path: ['email'], message: 'Invalid email' }] }),
    ).toEqual({ email: 'Invalid email' });
  });

  it("reads Zod v4's treeifyError shape", () => {
    expect(
      flattenFieldErrors({
        errors: [],
        properties: {
          notes: { errors: ['Invalid input: expected string, received null'] },
          weightKg: { errors: ['weightKg must be a positive number'] },
        },
      }),
    ).toEqual({
      notes: 'Invalid input: expected string, received null',
      weightKg: 'weightKg must be a positive number',
    });
  });

  it('reads a nested v4 tree, keyed by path', () => {
    expect(
      flattenFieldErrors({
        errors: [],
        properties: {
          sources: { errors: [], properties: { weight: { errors: ['Required'] } } },
        },
      }),
    ).toEqual({ 'sources.weight': 'Required' });
  });

  it('reads a treeified error', () => {
    expect(
      flattenFieldErrors({
        _errors: [],
        email: { _errors: ['Invalid email'] },
        password: { _errors: ['Too short'] },
      }),
    ).toEqual({ email: 'Invalid email', password: 'Too short' });
  });

  it('joins nested paths so a nested field is still addressable', () => {
    expect(
      flattenFieldErrors([{ path: ['sources', 'weight'], message: 'Required' }]),
    ).toEqual({ 'sources.weight': 'Required' });
  });

  it('keeps the first message per field', () => {
    expect(
      flattenFieldErrors([
        { path: ['email'], message: 'Invalid email' },
        { path: ['email'], message: 'Required' },
      ]),
    ).toEqual({ email: 'Invalid email' });
  });

  it('is undefined when there is nothing usable', () => {
    expect(flattenFieldErrors(undefined)).toBeUndefined();
    expect(flattenFieldErrors([])).toBeUndefined();
    expect(flattenFieldErrors({ _errors: [] })).toBeUndefined();
  });

  it('reaches normalizeError only for validation errors', () => {
    const validation = normalizeError(
      envelope(400, API_ERROR_CODES.VALIDATION_ERROR, 'Invalid body', [
        { path: ['email'], message: 'Invalid email' },
      ]),
    );
    expect(validation.fieldErrors).toEqual({ email: 'Invalid email' });

    const other = normalizeError(envelope(404, API_ERROR_CODES.NOT_FOUND, 'Gone'));
    expect(other.fieldErrors).toBeUndefined();
  });
});

describe('isRetryable — the rule the offline queue runs on', () => {
  it('retries what could plausibly succeed later', () => {
    for (const status of ['FETCH_ERROR', 'TIMEOUT_ERROR']) {
      expect(isRetryable(normalizeError({ status, error: 'x' }))).toBe(true);
    }
    expect(
      isRetryable(normalizeError(envelope(500, API_ERROR_CODES.INTERNAL_ERROR, 'x'))),
    ).toBe(true);
    expect(isRetryable(normalizeError({ status: 'FETCH_ERROR' }, { isOnline: false }))).toBe(
      true,
    );
  });

  it('gives up on what cannot — one bad request must not block the queue', () => {
    const terminal = [
      envelope(400, API_ERROR_CODES.VALIDATION_ERROR, 'x'),
      envelope(401, API_ERROR_CODES.INVALID_CREDENTIALS, 'x'),
      envelope(401, API_ERROR_CODES.INVALID_REFRESH_TOKEN, 'x'),
      envelope(404, API_ERROR_CODES.NOT_FOUND, 'x'),
      envelope(409, API_ERROR_CODES.EMAIL_TAKEN, 'x'),
    ];
    for (const error of terminal) {
      expect(isRetryable(normalizeError(error))).toBe(false);
    }
  });
});

describe('userMessage', () => {
  it('never leaks a status code or a stack trace', () => {
    const messages = [
      normalizeError({ status: 'FETCH_ERROR' }, { isOnline: false }),
      normalizeError({ status: 'TIMEOUT_ERROR' }),
      normalizeError({ status: 503, data: undefined }),
      normalizeError(undefined),
    ].map(userMessage);

    for (const message of messages) {
      expect(message).not.toMatch(/\d{3}/);
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('tells an offline user their data is safe', () => {
    const message = userMessage(normalizeError({ status: 'FETCH_ERROR' }, { isOnline: false }));
    expect(message).toMatch(/offline/i);
    expect(message).toMatch(/sync/i);
  });

  it('defers to the field messages on a validation error', () => {
    const error = normalizeError(
      envelope(400, API_ERROR_CODES.VALIDATION_ERROR, 'Body failed validation', [
        { path: ['email'], message: 'Invalid email' },
      ]),
    );
    expect(userMessage(error)).toBe('Some details need fixing.');
  });
});

describe('authMessage — the transport copy, minus the check-in promises', () => {
  it('does not promise a failed sign-in was saved or will sync', () => {
    for (const error of [
      normalizeError({ status: 'FETCH_ERROR' }, { isOnline: false }),
      normalizeError({ status: 'FETCH_ERROR' }, { isOnline: true }),
      normalizeError({ status: 'TIMEOUT_ERROR' }),
    ]) {
      expect(authMessage(error)).not.toMatch(/saved|safe|sync/i);
      expect(authMessage(error).length).toBeGreaterThan(0);
    }
  });

  it('tells an offline user to connect, not that their data is queued', () => {
    const message = authMessage(normalizeError({ status: 'FETCH_ERROR' }, { isOnline: false }));
    expect(message).toMatch(/offline/i);
    expect(message).toMatch(/connect/i);
  });

  it('falls through to userMessage for everything the server answered', () => {
    for (const error of [
      normalizeError(envelope(401, API_ERROR_CODES.INVALID_CREDENTIALS, 'x')),
      normalizeError(envelope(409, API_ERROR_CODES.EMAIL_TAKEN, 'x')),
      normalizeError(envelope(500, API_ERROR_CODES.INTERNAL_ERROR, 'x')),
    ]) {
      expect(authMessage(error)).toBe(userMessage(error));
    }
  });
});

describe('the OTP codes are a complaint, not an expired session', () => {
  const otpCodes = [API_ERROR_CODES.INVALID_OTP, API_ERROR_CODES.NO_PENDING_SIGNUP];

  it.each(otpCodes)('%s never reads as a session problem', code => {
    const error = normalizeError(envelope(400, code, "That code isn't right"));
    expect(error.kind).not.toBe('sessionExpired');
    expect(error.kind).toBe('validation');
  });

  it.each(otpCodes)('%s is not refreshable', code => {
    expect(REFRESHABLE_CODES).not.toContain(code);
  });

  it.each(otpCodes)('%s shows the server wording, with no field errors', code => {
    const error = normalizeError(envelope(400, code, 'the specific reason'));
    expect(error.fieldErrors).toBeUndefined();
    expect(userMessage(error)).toBe('the specific reason');
    expect(authMessage(error)).toBe('the specific reason');
  });

  it('is not retryable — a wrong code will not fix itself', () => {
    expect(isRetryable(normalizeError(envelope(400, API_ERROR_CODES.INVALID_OTP, 'x')))).toBe(
      false,
    );
  });
});
