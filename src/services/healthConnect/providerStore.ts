import { Linking } from 'react-native';
import { PROVIDER_PACKAGE } from '@/domain/healthConnect/provider';
import { log } from './healthConnectService';

/** Opens the Play app directly when it is there. */
const MARKET_URL = `market://details?id=${PROVIDER_PACKAGE}`;
/** Always handled by a browser, so this is the fallback rather than the first try. */
const WEB_URL = `https://play.google.com/store/apps/details?id=${PROVIDER_PACKAGE}`;

/**
 * Used for both "not installed" and "needs an update" — the same listing
 * resolves both, showing Install or Update as appropriate.
 */
export async function openProviderInstall(): Promise<void> {
  try {
    await Linking.openURL(MARKET_URL);
  } catch (marketError) {
    // No Play app (an emulator without Google services, a device with it
    // disabled). The web listing still gets them there.
    log('opening the Play listing failed, trying the web URL', marketError);
    try {
      await Linking.openURL(WEB_URL);
    } catch (webError) {
      log('opening the web Play listing failed', webError);
    }
  }
}
