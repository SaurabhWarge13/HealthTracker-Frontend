import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react-native';
import type { ProgressStatus } from '@/domain/progress/progress';
import { AppChip, type AppChipVariant } from './AppChip';

export type StatusPillProps = {
  status: ProgressStatus;
  /** Whether a target weight exists, which decides judging vs describing. */
  hasTarget: boolean;
  /** Direction of recent movement, for the neutral wording. */
  trendingDown?: boolean;
  style?: StyleProp<ViewStyle>;
};

type Presentation = { label: string; variant: AppChipVariant; icon?: LucideIcon };

const withTarget: Record<ProgressStatus, Presentation> = {
  improving: { label: 'Improving', variant: 'positive', icon: TrendingUp },
  steady: { label: 'Holding steady', variant: 'steady', icon: Minus },
  offTrack: { label: 'Off track', variant: 'neutral', icon: TrendingDown },
  notEnoughData: { label: 'Not enough data', variant: 'neutral' },
};

export function StatusPill({
  status,
  hasTarget,
  trendingDown = true,
  style,
}: StatusPillProps) {
  let presentation = withTarget[status];

  if (!hasTarget && status !== 'notEnoughData') {
    // No target means no opinion: describe the movement, don't grade it.
    presentation =
      status === 'steady'
        ? { label: 'Steady', variant: 'steady', icon: Minus }
        : trendingDown
        ? { label: 'Trending down', variant: 'positive', icon: TrendingDown }
        : { label: 'Trending up', variant: 'positive', icon: TrendingUp };
  }

  return (
    <AppChip
      label={presentation.label}
      variant={presentation.variant}
      size="lg"
      icon={presentation.icon}
      style={style}
    />
  );
}
