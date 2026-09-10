import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';
import { AppButton } from './AppButton';
import { AppIcon, type AppIconSize } from './AppIcon';
import { AppText } from './AppText';

export type EmptyStateProps = {
  icon: LucideIcon;
  /** Omitted for the inline dashboard variant, which leads with the copy. */
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Dashed reads as "this is missing"; solid as "nothing here yet". */
  dashed?: boolean;
  /** 64 inline in a card, 72 as a full-card state. */
  ringSize?: 64 | 72;
  iconSize?: AppIconSize;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  dashed = false,
  ringSize = 72,
  iconSize = 'xxl',
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.ring,
          dashed ? styles.dashed : styles.solid,
          {
            width: ringSize,
            height: ringSize,
            borderColor: colors.userChartSoft,
          },
        ]}
      >
        <AppIcon icon={icon} size={iconSize} color="userChart" strokeWidth={1.6} />
      </View>

      {title !== undefined ? (
        <AppText variant="cardTitle" align="center">
          {title}
        </AppText>
      ) : null}

      <AppText
        variant={title === undefined ? 'body' : 'bodySmall'}
        color="textMuted"
        align="center"
        style={styles.message}
      >
        {message}
      </AppText>

      {actionLabel !== undefined && onAction !== undefined ? (
        <AppButton
          label={actionLabel}
          size={52}
          fullWidth
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 14,
  },
  ring: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: { borderStyle: 'solid' },
  dashed: { borderStyle: 'dashed' },
  message: { maxWidth: 250 },
  action: { marginTop: spacing.xs + 2 },
});
