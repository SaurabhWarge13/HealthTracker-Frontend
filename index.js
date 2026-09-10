/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundHandler } from './src/services/notifications';

/**
 * Registered at module scope, before anything renders: notifee requires a
 * background handler to exist the moment a notification is interacted with
 * while the app is not in the foreground, and a press on a backgrounded app
 * reaches nothing else. See the comment on `pendingPress` for why.
 */
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
