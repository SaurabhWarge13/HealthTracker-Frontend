import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { formatDelta } from '@/utils/formatters';
import { AppChip, type AppChipSize } from './AppChip';

const STEADY_BAND_KG = 0.05;

export type DeltaBadgeProps = {
  deltaKg: number | null;
  suffix?: string;
  size?: AppChipSize;
  style?: StyleProp<ViewStyle>;
};

export function DeltaBadge({
  deltaKg,
  suffix,
  size = 'md',
  style,
}: DeltaBadgeProps) {
  if (deltaKg === null) {
    return <AppChip label="—" variant="neutral" size={size} style={style} />;
  }

  const steady = Math.abs(deltaKg) < STEADY_BAND_KG;
  const arrow = steady ? '' : deltaKg < 0 ? '↓ ' : '↑ ';
  const tail = suffix === undefined ? '' : ` ${suffix}`;

  return (
    <AppChip
      label={`${arrow}${formatDelta(deltaKg)}${tail}`}
      variant={steady ? 'steady' : 'positive'}
      size={size}
      style={style}
    />
  );
}
