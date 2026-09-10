/**
 * The refresh token, and only the refresh token.
 *
 * The access token stays in redux memory and dies with the process — that is
 * asserted in authSlice and honoured by the persistence layer, which strips it
 * before writing. The refresh token is the one credential that has to outlive
 * the app, so it goes to the OS keystore (Keychain / Android Keystore) rather
 * than into MMKV beside ordinary state.
 *
 * Every call is failure-tolerant. The keystore can be unavailable — a device
 * with no screen lock, a restricted work profile, an emulator quirk — and none
 * of those should take the app down. A failure reads as "no stored token",
 * which sends the user to Login: recoverable, and never a crash.
 */
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.healthtracker.refreshToken';

/**
 * Keychain stores a pair, but only the password half carries meaning here.
 * The username is a fixed label so the entry is recognisable in a keystore
 * inspector.
 */
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
  } catch {
    // Already gone, or the keystore is unavailable. Either way there is
    // nothing further to do, and a failed logout must not trap the user.
  }
}
