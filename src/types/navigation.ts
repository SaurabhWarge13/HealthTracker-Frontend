import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  /** The address the code was sent to, so the screen can name it. */
  VerifyOtp: { email: string };
};

export type OnboardingStackParamList = {
  Name: undefined;
  HealthConnect: undefined;
  Baseline: undefined;
  Goals: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
};

/**
 * The profile values Settings can change. Each opens the same one-field
 * editor — five near-identical screens would be five places for a range rule
 * to drift.
 */
export type EditableProfileField =
  | 'baselineWeight'
  | 'height'
  | 'stepGoal'
  | 'waterGoal'
  | 'sleepGoal'
  | 'targetWeight';

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  /** No id → create. With id → edit that check-in. */
  CheckInForm: { id?: string } | undefined;
  /** `id` may be a server id or a local (unsynced) id */
  CheckInDetail: { id: string };
  CheckInNotFound: { id?: string } | undefined;
  /** The one-field edit sheet; also where "Add height" lands. */
  EditProfileField: { field: EditableProfileField };
};

// Screen-prop helpers ------------------------------------------------------

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> =
  NativeStackScreenProps<OnboardingStackParamList, T>;

export type MainStackScreenProps<T extends keyof MainStackParamList> =
  NativeStackScreenProps<MainStackParamList, T>;

/** Tab screens can also push MainStack routes (form, detail). */
export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    NativeStackScreenProps<MainStackParamList>
  >;

/** Union of every route reachable through `navigationRef`. */
export type RootParamList = AuthStackParamList &
  OnboardingStackParamList &
  MainStackParamList;

declare global {
  namespace ReactNavigation {
    interface RootParamList
      extends AuthStackParamList,
        OnboardingStackParamList,
        MainStackParamList {}
  }
}

// Deep links ---------------------------------------------------------------

/** Parsed form of `healthtracker://checkin/:id`. */
export type DeepLinkTarget = { kind: 'checkin'; id: string };
