import React, { useCallback } from 'react';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { BottomTabBar } from '@/components/layout';
import { CheckInHistoryScreen } from '@/screens/checkins/CheckInHistoryScreen';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import type { MainTabParamList } from '@/types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Three tabs, no centre FAB — a check-in is a deliberate act, so its button
 * lives in the Progress card instead.
 *
 * The bar itself is ours rather than the platform default, so the active tab
 * gets the tinted pill from artboard 2a.
 */
export function BottomTabNavigator() {
  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => <BottomTabBar {...props} />,
    [],
  );

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="History" component={CheckInHistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
