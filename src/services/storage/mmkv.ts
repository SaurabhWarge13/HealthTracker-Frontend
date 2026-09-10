/**
 * The app's only MMKV instance.
 *
 * MMKV is chosen over AsyncStorage for one reason that matters here: it reads
 * synchronously, so the store can be created already holding the last session
 * instead of rendering Login and correcting itself a frame later.
 *
 * Construction is guarded. Everything downstream promises that a storage
 * failure costs a cached session and never the app, and that promise is empty
 * if the constructor itself can throw at import time — which happens before
 * any error boundary exists, and takes the whole app down.
 */
import { MMKV } from 'react-native-mmkv';

/** The only surface the app uses. Keeping it this small is what makes a fallback viable. */
export type KeyValueStore = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
};

/** Satisfies the contract, forgets everything. The app runs; it just won't persist. */
function createMemoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getString: key => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    delete: key => {
      values.delete(key);
    },
  };
}

function createStore(): KeyValueStore {
  try {
    return new MMKV({ id: 'healthtracker' });
  } catch (error) {
    if (__DEV__) {
      console.warn('[storage] MMKV unavailable, running without persistence', error);
    }
    return createMemoryStore();
  }
}

export const storage: KeyValueStore = createStore();
