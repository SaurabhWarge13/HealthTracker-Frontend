import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BaselineScreen } from '@/screens/onboarding/BaselineScreen';
import { GoalsScreen } from '@/screens/onboarding/GoalsScreen';
import { HealthConnectScreen } from '@/screens/onboarding/HealthConnectScreen';
import { NameScreen } from '@/screens/onboarding/NameScreen';
import { selectOnboardingStep } from '@/store/onboarding/onboardingSelectors';
import { useAppSelector } from '@/store/hooks';
import type { OnboardingStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const STEP_ROUTE: Record<number, keyof OnboardingStackParamList> = {
  1: 'Name',
  2: 'HealthConnect',
  3: 'Baseline',
  4: 'Goals',
};

export function OnboardingStack() {
  const step = useAppSelector(selectOnboardingStep);

  return (
    <Stack.Navigator
      initialRouteName={STEP_ROUTE[step] ?? 'Name'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Name" component={NameScreen} />
      <Stack.Screen name="HealthConnect" component={HealthConnectScreen} />
      <Stack.Screen name="Baseline" component={BaselineScreen} />
      <Stack.Screen name="Goals" component={GoalsScreen} />
    </Stack.Navigator>
  );
}
