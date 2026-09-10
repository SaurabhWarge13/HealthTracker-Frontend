import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppIcon, AppText } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { radius, type ColorName, type TextVariant } from '@/theme';

export type AppChipVariant =
  /** Health Connect / device data. */
  | 'device'
  /** The user's own data. */
  | 'user'
  /** Improving, downward deltas. */
  | 'positive'
  /** Holding steady. */
  | 'steady'
  /** No data, not connected, "None yet". */
  | 'neutral'
  /** Outlined, hint text — "Optional". */
  | 'outlined';

export type AppChipSize = 'sm' | 'md' | 'lg';

export type AppChipProps = {
  label: string;
  variant?: AppChipVariant;
  size?: AppChipSize;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
};

type ChipFill = {
  background: ColorName | null;
  foreground: ColorName;
  border?: ColorName;
};

const VARIANT: Record<AppChipVariant, ChipFill> = {
  device: { background: 'deviceTint', foreground: 'deviceAccent' },
  user: { background: 'userTint', foreground: 'userAccent' },
  positive: { background: 'userTint', foreground: 'statusImproving' },
  steady: { background: 'surfaceNeutral', foreground: 'statusSteady' },
  neutral: { background: 'surfaceNeutral', foreground: 'textHint' },
  outlined: { background: null, foreground: 'textHint', border: 'border' },
};

const SIZE: Record<
  AppChipSize,
  {
    paddingVertical: number;
    paddingHorizontal: number;
    text: TextVariant;
    icon: 'xs' | 'sm';
    gap: number;
  }
> = {
  sm: { paddingVertical: 4, paddingHorizontal: 10, text: 'chip', icon: 'xs', gap: 4 },
  md: { paddingVertical: 5, paddingHorizontal: 11, text: 'captionStrong', icon: 'sm', gap: 4 },
  lg: { paddingVertical: 6, paddingHorizontal: 12, text: 'captionStrong', icon: 'sm', gap: 5 },
};

export function AppChip({
  label,
  variant = 'neutral',
  size = 'sm',
  icon,
  style,
}: AppChipProps) {
  const { colors } = useTheme();
  const fill = VARIANT[variant];
  const metrics = SIZE[size];

  return (
    <View
      style={[
        styles.base,
        fill.background === null && styles.transparent,
        fill.border !== undefined && styles.outlined,
        {
          paddingVertical: metrics.paddingVertical,
          paddingHorizontal: metrics.paddingHorizontal,
          gap: metrics.gap,
          ...(fill.background !== null
            ? { backgroundColor: colors[fill.background] }
            : null),
          ...(fill.border !== undefined
            ? { borderColor: colors[fill.border] }
            : null),
        },
        style,
      ]}
    >
      {icon ? <AppIcon icon={icon} size={metrics.icon} color={fill.foreground} /> : null}
      <AppText variant={metrics.text} color={fill.foreground}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  transparent: { backgroundColor: 'transparent' },
  outlined: { borderWidth: 1 },
});
