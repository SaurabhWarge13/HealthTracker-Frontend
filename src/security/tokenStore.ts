import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.healthtracker.refreshToken';

const ACCOUNT = 'refreshToken';

export async function saveRefreshToken(token: string): Promise<boolean> {
  try {
    const result = await Keychain.setGenericPassword(ACCOUNT, token, {
      service: SERVICE,
    });
    return result !== false;
  } catch {
    return false;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    const result = await Keychain.getGenericPassword({ service: SERVICE });
    if (result === false || result.password === '') {
      return null;
    }
    return result.password;
  } catch {
    return null;
  }
}

export async function clearRefreshToken(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
  } catch {}
}
