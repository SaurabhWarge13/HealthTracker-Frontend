import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { layout, radius, type ColorName } from '@/theme';
import { AppIcon, type AppIconSize } from './AppIcon';

export type AppIconButtonVariant = 'plain' | 'filledSurface' | 'filledNeutral';

export type AppIconButtonProps = {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  /** Visual diameter. Touch target is padded to 48 regardless. */
  size?: number;
  iconSize?: AppIconSize;
  variant?: AppIconButtonVariant;
  color?: ColorName;
  disabled?: boolean;
  /** Small dot in the top-right corner (notification bell). */
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const BACKGROUND: Record<AppIconButtonVariant, ColorName | null> = {
  plain: null,
  filledSurface: 'surface',
  filledNeutral: 'surfaceNeutral',
};

export function AppIconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 44,
  iconSize = 'base',
  variant = 'plain',
  color = 'textPrimary',
  disabled = false,
  badge = false,
  style,
  testID,
}: AppIconButtonProps) {
  const { colors } = useTheme();
  const background = BACKGROUND[variant];

  // Grow the touch area to the 48pt minimum without changing the visuals.
  const slop = Math.max(0, (layout.minTapTarget - size) / 2);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={slop}
      // No ripple: RN's bounded ripple mask is a rectangle. See AppButton.
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        background !== null && { backgroundColor: colors[background] },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <AppIcon icon={icon} size={iconSize} color={color} />
      {badge ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: colors.danger,
              borderColor: background !== null ? colors[background] : colors.surface,
            },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
});
