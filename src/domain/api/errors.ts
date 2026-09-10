/** Every error code the API can return. */
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NO_TOKEN: 'NO_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  /**
   * Both are 400, never 401. A 401 would be read as `sessionExpired` and send
   * the reauth wrapper looking for a refresh token that does not exist yet —
   * a mistyped code would look like a dead session.
   */
  INVALID_OTP: 'INVALID_OTP',
  NO_PENDING_SIGNUP: 'NO_PENDING_SIGNUP',
  NOT_FOUND: 'NOT_FOUND',
  SIMULATED_FAILURE: 'SIMULATED_FAILURE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * The two codes that mean "this access token is dead, get a new one" — as
 * opposed to the other three 401s, which mean something the user must see.
 */
export const REFRESHABLE_CODES: readonly string[] = [
  API_ERROR_CODES.NO_TOKEN,
  API_ERROR_CODES.INVALID_TOKEN,
];

export type ApiErrorKind =
  // Never reached the server.
  | 'offline'
  | 'timeout'
  | 'network'
  // The 401s that are not "refresh me".
  | 'badCredentials'
  | 'sessionExpired'
  // The server answered, with a complaint.
  | 'validation'
  | 'emailTaken'
  | 'notFound'
  | 'server'
  | 'unknown';

/** Field path → message, ready for react-hook-form's `setError`. */
type FieldErrors = Record<string, string>;

export type ApiError = {
  kind: ApiErrorKind;
  /** HTTP status when there was one. */
  status?: number;
  /** The server's machine-readable code when it sent one. */
  code?: string;
  /** Safe to show a user. */
  message: string;
  /** Only ever present on `validation`. */
  fieldErrors?: FieldErrors;
};


type ServerError = { code?: string; message?: string; fields?: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Every error the API returns is wrapped as `{ error: { code, message } }`.
 * Anything that does not match is treated as absent rather than guessed at.
 */
export function extractServerError(data: unknown): ServerError | null {
  if (!isRecord(data) || !isRecord(data.error)) {
    return null;
  }
  const { code, message, fields } = data.error;
  return {
    code: typeof code === 'string' ? code : undefined,
    message: typeof message === 'string' ? message : undefined,
    fields,
  };
}

/**
 * `VALIDATION_ERROR` carries the Zod issue tree, and Zod hands that over in
 * three different shapes depending on version and formatter:
 *
 *   flat issues   `[{ path, message }]`, or `{ issues: [...] }`
 *   v4 treeify    `{ errors: [], properties: { notes: { errors: [...] } } }`
 *   v3 format     `{ _errors: [], notes: { _errors: [...] } }`
 *
 * All three are accepted. Recognising only one and guessing wrong is not a
 * loud failure — every field message is silently dropped, `fieldErrors` comes
 * back undefined, and the caller falls through to showing the server's raw
 * message. That is exactly how internal Zod text once reached users.
 */
export function flattenFieldErrors(fields: unknown): FieldErrors | undefined {
  const flat: FieldErrors = {};

  const fromIssues = (issues: unknown[]): void => {
    for (const issue of issues) {
      if (!isRecord(issue) || typeof issue.message !== 'string') {
        continue;
      }
      const path = Array.isArray(issue.path)
        ? issue.path.map(String).join('.')
        : '';
      // First message per field wins; later ones are usually less specific.
      if (path !== '' && flat[path] === undefined) {
        flat[path] = issue.message;
      }
    }
  };

  const fromTree = (node: unknown, path: string): void => {
    if (!isRecord(node)) {
      return;
    }
    const errors = node._errors;
    if (Array.isArray(errors) && typeof errors[0] === 'string' && path !== '') {
      flat[path] = errors[0];
    }
    for (const [key, child] of Object.entries(node)) {
      if (key !== '_errors') {
        fromTree(child, path === '' ? key : `${path}.${key}`);
      }
    }
  };

  /**
   * Zod v4's `treeifyError`: messages sit in `errors`, children in
   * `properties` (objects) or `items` (arrays), so the nesting key is not the
   * field name the way it is in v3.
   */
  const fromV4Tree = (node: unknown, path: string): void => {
    if (!isRecord(node)) {
      return;
    }
    const errors = node.errors;
    if (Array.isArray(errors) && typeof errors[0] === 'string' && path !== '') {
      flat[path] ??= errors[0];
    }
    for (const key of ['properties', 'items'] as const) {
      const children = node[key];
      if (!isRecord(children)) {
        continue;
      }
      for (const [name, child] of Object.entries(children)) {
        fromV4Tree(child, path === '' ? name : `${path}.${name}`);
      }
    }
  };

  if (Array.isArray(fields)) {
    fromIssues(fields);
  } else if (isRecord(fields) && Array.isArray(fields.issues)) {
    fromIssues(fields.issues);
  } else if (isRecord(fields) && (isRecord(fields.properties) || isRecord(fields.items))) {
    fromV4Tree(fields, '');
  } else {
    fromTree(fields, '');
  }

  return Object.keys(flat).length > 0 ? flat : undefined;
}

const KIND_BY_CODE: Record<string, ApiErrorKind> = {
  [API_ERROR_CODES.VALIDATION_ERROR]: 'validation',
  [API_ERROR_CODES.NO_TOKEN]: 'sessionExpired',
  [API_ERROR_CODES.INVALID_TOKEN]: 'sessionExpired',
  [API_ERROR_CODES.INVALID_CREDENTIALS]: 'badCredentials',
  [API_ERROR_CODES.INVALID_REFRESH_TOKEN]: 'sessionExpired',
  [API_ERROR_CODES.EMAIL_TAKEN]: 'emailTaken',
  /**
   * `validation` without `fieldErrors`, so `userMessage` passes the server's
   * own wording through — which is already the sentence the user needs.
   */
  [API_ERROR_CODES.INVALID_OTP]: 'validation',
  [API_ERROR_CODES.NO_PENDING_SIGNUP]: 'validation',
  [API_ERROR_CODES.NOT_FOUND]: 'notFound',
  [API_ERROR_CODES.SIMULATED_FAILURE]: 'server',
  [API_ERROR_CODES.INTERNAL_ERROR]: 'server',
};

/** Used only when the server sent no code — a proxy or crash, say. */
function kindByStatus(status: number): ApiErrorKind {
  if (status === 400) {
    return 'validation';
  }
  if (status === 401) {
    return 'sessionExpired';
  }
  if (status === 404) {
    return 'notFound';
  }
  // EMAIL_TAKEN is the only 409 in the whole surface.
  if (status === 409) {
    return 'emailTaken';
  }
  if (status >= 500) {
    return 'server';
  }
  return 'unknown';
}

type NormalizeOptions = {
  /**
   * A failed fetch alone cannot tell "no signal" from "server is down", and
   * the difference decides whether the user is told to check their connection
   * or that something broke on our end.
   */
  isOnline?: boolean;
};

export function normalizeError(
  error: unknown,
  options: NormalizeOptions = {},
): ApiError {
  if (!isRecord(error)) {
    return { kind: 'unknown', message: DEFAULT_MESSAGE };
  }

  const { status } = error;

  // RTK Query's non-HTTP failures.
  if (status === 'FETCH_ERROR') {
    const kind: ApiErrorKind = options.isOnline === false ? 'offline' : 'network';
    return { kind, message: messageFor(kind) };
  }
  if (status === 'TIMEOUT_ERROR') {
    return { kind: 'timeout', message: messageFor('timeout') };
  }
  if (status === 'PARSING_ERROR') {
    const original = typeof error.originalStatus === 'number' ? error.originalStatus : undefined;
    return {
      kind: 'server',
      status: original,
      message: messageFor('server'),
    };
  }

  if (typeof status !== 'number') {
    return { kind: 'unknown', message: DEFAULT_MESSAGE };
  }

  const server = extractServerError(error.data);
  const kind =
    server?.code !== undefined
      ? KIND_BY_CODE[server.code] ?? kindByStatus(status)
      : kindByStatus(status);

  return {
    kind,
    status,
    code: server?.code,
    // The server's own wording is the more specific of the two; ours is the
    // fallback for a status with no envelope.
    message: server?.message ?? messageFor(kind),
    fieldErrors:
      kind === 'validation' ? flattenFieldErrors(server?.fields) : undefined,
  };
}

/**
 * Retry what could plausibly succeed next time, give up on what cannot.
 * Without the split, one malformed request retries forever and blocks
 * everything queued behind it.
 */
export function isRetryable(error: ApiError): boolean {
  switch (error.kind) {
    case 'offline':
    case 'timeout':
    case 'network':
    case 'server':
      return true;
    default:
      return false;
  }
}

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

function messageFor(kind: ApiErrorKind): string {
  switch (kind) {
    case 'offline':
      return "You're offline. This is saved on your device and will sync when you're back.";
    case 'network':
      return "Can't reach the server right now. Your data is safe on this device.";
    case 'timeout':
      return 'That took too long. Check your connection and try again.';
    case 'badCredentials':
      return 'Email or password is incorrect.';
    case 'sessionExpired':
      return 'Your session ended. Sign in again — nothing on this device is lost.';
    case 'validation':
      return 'Some details need fixing.';
    case 'emailTaken':
      return 'That email already has an account.';
    case 'notFound':
      return "That's no longer there.";
    case 'server':
      return 'Something went wrong on our end. Please try again.';
    default:
      return DEFAULT_MESSAGE;
  }
}

/** What a user should read. Never a status code, never a stack trace. */
export function userMessage(error: ApiError): string {
  // A validation summary is useless on its own — the field messages carry it.
  if (error.kind === 'validation' && error.fieldErrors !== undefined) {
    return messageFor('validation');
  }
  return error.message !== '' ? error.message : DEFAULT_MESSAGE;
}

/**
 * The transport defaults above are written for check-ins, where a failed
 * request means something is safely queued on the device. Nothing is queued
 * when a sign-in fails, so "this is saved on your device" would be a lie.
 */
const AUTH_MESSAGE: Partial<Record<ApiErrorKind, string>> = {
  offline: "You're offline. Connect to the internet to sign in.",
  network: "Can't reach the server. Check your connection and try again.",
  timeout: 'That took too long. Check your connection and try again.',
};

/** `userMessage`, with sign-in and sign-up wording for the transport kinds. */
export function authMessage(error: ApiError): string {
  return AUTH_MESSAGE[error.kind] ?? userMessage(error);
}
