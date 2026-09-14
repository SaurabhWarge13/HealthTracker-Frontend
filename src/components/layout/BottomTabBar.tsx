import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ClipboardList,
  House,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { AppIcon, AppText } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { layout, spacing } from '@/theme';

const ICONS: Record<string, LucideIcon> = {
  Home: House,
  History: ClipboardList,
  Settings: SettingsIcon,
};

export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + layout.screenPadding,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
        const Icon = ICONS[route.name] ?? House;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            android_ripple={{ color: colors.surfaceNeutralPressed, borderless: true }}
            style={styles.item}
          >
            <View style={styles.iconWrap}>
              <AppIcon
                icon={Icon}
                size="base"
                color={focused ? 'userAccent' : 'textHint'}
              />
            </View>
            <AppText
              variant={focused ? 'chip' : 'overline'}
              color={focused ? 'userAccent' : 'textHint'}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    paddingHorizontal: layout.screenPadding,
  },
  item: {
    flex: 1,
    minHeight: layout.minTapTarget,
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconWrap: {
    width: 64,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
