import { MMKV } from 'react-native-mmkv';

export type KeyValueStore = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
};

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
