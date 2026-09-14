import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronLeft } from 'lucide-react-native';
import { AppButton, AppIconButton, AppText } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';

export type ScreenHeaderVariant = 'onboarding' | 'nav' | 'modal';

export type ScreenHeaderProps = {
  variant?: ScreenHeaderVariant;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backIcon?: LucideIcon;
  backAccessibilityLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  actionIconLabel?: string;
  actionRef?: React.Ref<View>;
  opaque?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({
  variant = 'nav',
  title,
  subtitle,
  onBack,
  backIcon,
  backAccessibilityLabel,
  actionLabel,
  onAction,
  actionIcon,
  actionIconLabel,
  actionRef,
  opaque = variant !== 'onboarding',
  style,
}: ScreenHeaderProps) {
  const { colors } = useTheme();

  const container = [
    styles.base,
    variant === 'onboarding' ? styles.onboarding : styles.standard,
    opaque && { backgroundColor: colors.surface },
    style,
  ];

  return (
    <View style={container}>
      {onBack !== undefined ? (
        <AppIconButton
          icon={backIcon ?? ChevronLeft}
          onPress={onBack}
          accessibilityLabel={backAccessibilityLabel ?? 'Go back'}
          size={44}
        />
      ) : (
        <View style={styles.backSpacer} />
      )}

      {title !== undefined ? (
        <View style={styles.titleStack}>
          <AppText variant="cardTitle" accessibilityRole="header" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle !== undefined ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      ) : (
        <View style={styles.titleStack} />
      )}

      {actionLabel !== undefined && onAction !== undefined ? (
        <AppButton
          label={actionLabel}
          variant="text"
          tone="muted"
          size={48}
          onPress={onAction}
        />
      ) : actionIcon !== undefined && onAction !== undefined ? (
        <View ref={actionRef} collapsable={false}>
          <AppIconButton
            icon={actionIcon}
            onPress={onAction}
            accessibilityLabel={actionIconLabel ?? 'More options'}
            size={44}
          />
        </View>
      ) : (
        <View style={styles.backSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onboarding: {
    height: 56,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
  },
  standard: {
    minHeight: 60,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  titleStack: { flex: 1, gap: 2, justifyContent: 'center' },
  backSpacer: { width: 44 },
});
