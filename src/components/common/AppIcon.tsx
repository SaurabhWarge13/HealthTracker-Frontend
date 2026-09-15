import React from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ColorName } from '@/theme';

export type AppIconSize = 'xs' | 'sm' | 'md' | 'base' | 'lg' | 'xl' | 'xxl';

const SIZE: Record<AppIconSize, { size: number; strokeWidth: number }> = {
  xs: { size: 12, strokeWidth: 2.4 },
  sm: { size: 14, strokeWidth: 2.4 },
  md: { size: 16, strokeWidth: 2 },
  base: { size: 20, strokeWidth: 2 },
  lg: { size: 24, strokeWidth: 1.8 },
  xl: { size: 28, strokeWidth: 1.6 },
  xxl: { size: 32, strokeWidth: 1.6 },
};

export type AppIconProps = {
  icon: LucideIcon;
  size?: AppIconSize;
  color?: ColorName;
  strokeWidth?: number;
  accessibilityLabel?: string;
};

export function AppIcon({
  icon: Icon,
  size = 'base',
  color = 'textPrimary',
  strokeWidth,
  accessibilityLabel,
}: AppIconProps) {
  const { colors } = useTheme();
  const token = SIZE[size];

  return (
    <Icon
      size={token.size}
      strokeWidth={strokeWidth ?? token.strokeWidth}
      color={colors[color]}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={accessibilityLabel === undefined}
      importantForAccessibility={
        accessibilityLabel === undefined ? 'no-hide-descendants' : 'yes'
      }
    />
  );
}
