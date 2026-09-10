import { Platform } from 'react-native';
import { API_MODE, LOCAL_URL, SERVER_URL } from '@env';

// A bad value fails on startup rather than defaulting: an APK silently
// pointing at localhost is indistinguishable from a server that is down.

// Jest imports this module too, and the banner is for a device, not a run.
const inTest =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.JEST_WORKER_ID !== undefined;

const SERVER_URL_PLACEHOLDER = 'https://<your-render-url>';

// `.env` is gitignored, so a fresh clone and CI have none — and every store
// test pulls this module in transitively. No suite makes a real request.
const TEST_BASE_URL = 'http://localhost:3000';

type ApiMode = 'server' | 'local';

const isApiMode = (value: string | undefined): value is ApiMode =>
  value === 'server' || value === 'local';

function fail(problem: string): never {
  throw new Error(
    `Invalid API configuration: ${problem}\n\n` +
      'Fix .env in the project root (copy .env.example if it is missing), then ' +
      'restart Metro with `yarn start --reset-cache`. These values are inlined ' +
      'at build time, so a plain reload keeps serving the old ones.',
  );
}

function resolveBaseUrl(): string {
  if (!isApiMode(API_MODE)) {
    fail(
      `API_MODE must be 'server' or 'local', but it is ${
        API_MODE === undefined || API_MODE === ''
          ? 'missing'
          : `'${API_MODE}'`
      }.`,
    );
  }

  const key = API_MODE === 'local' ? 'LOCAL_URL' : 'SERVER_URL';
  const raw = API_MODE === 'local' ? LOCAL_URL : SERVER_URL;
  const url = raw?.trim() ?? '';

  if (url === '') {
    fail(`${key} is required when API_MODE=${API_MODE}, but it is empty.`);
  }
  if (url === SERVER_URL_PLACEHOLDER) {
    fail(
      `SERVER_URL is still the ${SERVER_URL_PLACEHOLDER} placeholder. Put the ` +
        'deployed backend URL there, or set API_MODE=local to use a backend on ' +
        'this machine.',
    );
  }
  if (!/^https?:\/\//.test(url)) {
    fail(`${key} must start with http:// or https://, but it is '${url}'.`);
  }

  // A trailing slash would reach the server as a double slash on every path.
  return url.replace(/\/+$/, '');
}

export const API_BASE_URL = inTest ? TEST_BASE_URL : resolveBaseUrl();

// A wrong base URL and a dead server look identical from inside the app, so
// print the one fact that tells them apart.
if (__DEV__ && !inTest) {
  console.log(`[api] ${API_MODE} ${API_BASE_URL} (${Platform.OS})`);

  // Release builds block cleartext HTTP, so this works in debug and then
  // fails in the APK. Not fatal — a debug build may legitimately use one.
  if (API_MODE === 'server' && API_BASE_URL.startsWith('http://')) {
    console.warn(
      '[api] SERVER_URL is http://, which release builds block. The APK will ' +
        'fail to reach it — use https for anything you ship.',
    );
  }
}

/**
 * Long enough to survive a slow connection, short enough that a dead server
 * fails visibly instead of leaving a spinner running forever.
 */
export const API_TIMEOUT_MS = 15_000;
