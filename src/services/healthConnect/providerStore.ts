import { Linking } from 'react-native';
import { PROVIDER_PACKAGE } from '@/domain/healthConnect/provider';
import { log } from './healthConnectService';

const MARKET_URL = `market://details?id=${PROVIDER_PACKAGE}`;
const WEB_URL = `https://play.google.com/store/apps/details?id=${PROVIDER_PACKAGE}`;

export async function openProviderInstall(): Promise<void> {
  try {
    await Linking.openURL(MARKET_URL);
  } catch (marketError) {
    log('opening the Play listing failed, trying the web URL', marketError);
    try {
      await Linking.openURL(WEB_URL);
    } catch (webError) {
      log('opening the web Play listing failed', webError);
    }
  }
}
