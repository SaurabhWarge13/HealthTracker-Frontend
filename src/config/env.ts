import { Platform } from 'react-native';
import { API_MODE, LOCAL_URL, SERVER_URL } from '@env';

const inTest =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.JEST_WORKER_ID !== undefined;

const SERVER_URL_PLACEHOLDER = 'https://<your-render-url>';

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

  return url.replace(/\/+$/, '');
}

export const API_BASE_URL = inTest ? TEST_BASE_URL : resolveBaseUrl();

if (__DEV__ && !inTest) {
  console.log(`[api] ${API_MODE} ${API_BASE_URL} (${Platform.OS})`);

  if (API_MODE === 'server' && API_BASE_URL.startsWith('http://')) {
    console.warn(
      '[api] SERVER_URL is http://, which release builds block. The APK will ' +
        'fail to reach it — use https for anything you ship.',
    );
  }
}

export const API_TIMEOUT_MS = 15_000;
