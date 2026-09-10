import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { formatDelta } from '@/utils/formatters';
import { AppChip, type AppChipSize } from './AppChip';

/** Inside this band a change is noise, matching the progress calculation. */
const STEADY_BAND_KG = 0.05;

export type DeltaBadgeProps = {
  /** Change in kg. Null when there is nothing to compare against. */
  deltaKg: number | null;
  /** Appended in the detail summary: "↓ 0.3 kg from last". */
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
