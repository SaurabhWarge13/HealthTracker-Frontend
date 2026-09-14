import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CheckInDetailScreen } from '@/screens/checkins/CheckInDetailScreen';
import { CheckInFormScreen } from '@/screens/checkins/CheckInFormScreen';
import { CheckInNotFoundScreen } from '@/screens/checkins/CheckInNotFoundScreen';
import { EditProfileFieldScreen } from '@/screens/settings/EditProfileFieldScreen';
import {
  useConnectivity,
  useHealthConnectResume,
  useNotificationSchedule,
  useSync,
} from '@/hooks';
import type { MainStackParamList } from '@/types/navigation';
import { BottomTabNavigator } from './BottomTabNavigator';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  useHealthConnectResume();
  useNotificationSchedule();
  useConnectivity();
  useSync();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={BottomTabNavigator} />
      <Stack.Screen
        name="CheckInForm"
        component={CheckInFormScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="CheckInDetail" component={CheckInDetailScreen} />
      <Stack.Screen name="CheckInNotFound" component={CheckInNotFoundScreen} />
      <Stack.Screen
        name="EditProfileField"
        component={EditProfileFieldScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
