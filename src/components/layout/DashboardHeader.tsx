import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Settings as SettingsIcon } from 'lucide-react-native';
import { Avatar, AppIconButton, AppText } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { layout, spacing } from '@/theme';
import { formatHeaderDate } from '@/utils/formatters';

export type DashboardHeaderProps = {
  name: string;
  now?: number;
  hasNotification?: boolean;
  onPressNotifications?: () => void;
  onPressSettings?: () => void;
};

export function DashboardHeader({
  name,
  now = Date.now(),
  hasNotification = false,
  onPressNotifications,
  onPressSettings,
}: DashboardHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const greeting = name.trim() === '' ? 'Hi there' : `Hi, ${name.trim()}`;

  return (
    <View>
      <View
        style={[
          styles.band,
          { backgroundColor: colors.headerBand, paddingTop: insets.top + spacing.sm },
        ]}
      >
        <Avatar name={name || 'H'} size={44} background="surface" />

        <View style={styles.text}>
          <AppText variant="overline" color="headerBandText" numberOfLines={1}>
            {formatHeaderDate(now)}
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {greeting}
          </AppText>
        </View>

        {onPressNotifications !== undefined ? (
          <AppIconButton
            icon={Bell}
            onPress={onPressNotifications}
            accessibilityLabel="Notifications"
            size={40}
            variant="filledSurface"
            color="userAccent"
            badge={hasNotification}
          />
        ) : null}

        {onPressSettings !== undefined ? (
          <AppIconButton
            icon={SettingsIcon}
            onPress={onPressSettings}
            accessibilityLabel="Settings"
            size={40}
            variant="filledSurface"
            color="userAccent"
          />
        ) : null}
      </View>

      <View style={[styles.strip, { backgroundColor: colors.userAccent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.cardPadding,
  },
  text: { flex: 1, gap: 2 },
  strip: { height: 4, marginBottom: 20 },
});
