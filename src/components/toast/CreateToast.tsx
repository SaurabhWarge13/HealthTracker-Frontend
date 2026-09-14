import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { AppIcon, AppText } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { layout, radius, spacing, type ColorName } from '@/theme';

export type ToastVariant = 'success' | 'error' | 'info';

export type CreateToastProps = {
  text?: string;
  variant?: ToastVariant;
  style?: StyleProp<ViewStyle>;
};

type Tone = { background: ColorName; icon: ColorName; text: ColorName; glyph: LucideIcon };

const TONE: Record<ToastVariant, Tone> = {
  success: {
    background: 'userTint',
    icon: 'userAccent',
    text: 'textPrimary',
    glyph: CircleCheck,
  },
  error: {
    background: 'dangerTint',
    icon: 'danger',
    text: 'danger',
    glyph: TriangleAlert,
  },
  info: {
    background: 'surfaceNeutral',
    icon: 'textMuted',
    text: 'textMuted',
    glyph: Info,
  },
};

export function CreateToast({ text, variant = 'info', style }: CreateToastProps) {
  const { colors, isDark } = useTheme();
  const tone = TONE[variant];

  if (text === undefined || text === '') {
    return null;
  }

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityRole={variant === 'error' ? 'alert' : undefined}
      style={[
        styles.row,
        isDark ? styles.shadowDark : styles.shadowLight,
        isDark ? styles.darkEdge : styles.noEdge,
        {
          backgroundColor: colors[tone.background],
          shadowColor: colors.textPrimary,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <AppIcon icon={tone.glyph} size="base" color={tone.icon} />

      <AppText
        variant="bodySmall"
        color={tone.text}
        numberOfLines={3}
        style={styles.text}
      >
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderRadius: radius.input,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    marginHorizontal: layout.screenPadding,
  },
  text: { flex: 1 },
  shadowLight: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  shadowDark: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  darkEdge: { borderWidth: StyleSheet.hairlineWidth },
  noEdge: { borderWidth: 0 },
});
