import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
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

export type EditableProfileField =
  | 'baselineWeight'
  | 'height'
  | 'stepGoal'
  | 'waterGoal'
  | 'sleepGoal'
  | 'targetWeight';

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  CheckInForm: { id?: string } | undefined;
  CheckInDetail: { id: string };
  CheckInNotFound: { id?: string } | undefined;
  EditProfileField: { field: EditableProfileField };
};

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> =
  NativeStackScreenProps<OnboardingStackParamList, T>;

export type MainStackScreenProps<T extends keyof MainStackParamList> =
  NativeStackScreenProps<MainStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    NativeStackScreenProps<MainStackParamList>
  >;

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

export type DeepLinkTarget = { kind: 'checkin'; id: string };
