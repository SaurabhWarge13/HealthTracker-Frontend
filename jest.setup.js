/**
 * Native modules that need a stand-in under Jest.
 *
 * MMKV and Keychain do not appear here: MMKV detects Jest and swaps in a real
 * in-memory store, and Keychain is only reached through tokenStore, which the
 * tests that care about it mock directly.
 */

// NetInfo ships its own mock; without it, importing the module throws.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

/**
 * Toast is a singleton with its own animation timers. Stubbing it keeps those
 * out of every test that renders a screen, and lets the ones that care assert
 * on `Toast.show` directly.
 */
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));

/**
 * Notifee is a native module, so importing it under Jest throws — and it is
 * imported transitively by MainStack, which the App smoke test renders.
 *
 * The enums matter as much as the methods: they are consumed as *values*
 * (RepeatFrequency.DAILY, EventType.PRESS), so leaving them out fails at
 * import rather than at the assertion.
 */
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    getNotificationSettings: jest
      .fn()
      .mockResolvedValue({ authorizationStatus: 1 }),
    createChannel: jest.fn().mockResolvedValue('reminders'),
    createTriggerNotification: jest.fn().mockResolvedValue('id'),
    cancelTriggerNotification: jest.fn().mockResolvedValue(undefined),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    onForegroundEvent: jest.fn().mockReturnValue(() => {}),
    onBackgroundEvent: jest.fn(),
    openNotificationSettings: jest.fn().mockResolvedValue(undefined),
  },
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
  AndroidImportance: { DEFAULT: 3 },
  AndroidLaunchActivityFlag: { SINGLE_TOP: 1 },
  EventType: { UNKNOWN: -1, DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2 },
  RepeatFrequency: { NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2 },
  TriggerType: { TIMESTAMP: 0, INTERVAL: 1 },
}));
