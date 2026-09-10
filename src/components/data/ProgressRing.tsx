import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { AppIcon, AppText } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';

export type RingState = 'value' | 'noData' | 'notConnected';

export type ProgressRingProps = {
  icon: LucideIcon;
  /** 0–1. Clamped; values over 1 fill the ring rather than wrapping. */
  progress?: number;
  state?: RingState;
  size?: number;
  accessibilityLabel?: string;
};

const STROKE = 5;

export function ProgressRing({
  icon,
  progress = 0,
  state = 'value',
  size = 64,
  accessibilityLabel,
}: ProgressRingProps) {
  const { colors } = useTheme();

  const centre = size / 2;
  const r = centre - STROKE / 2 - 2.5;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, progress)) * circumference;

  // No permission dims the track itself, so the ring reads as absent rather
  // than as an empty measurement.
  const trackColor =
    state === 'notConnected' ? colors.deviceTrackOff : colors.deviceTrack;

  const iconColor =
    state === 'value' ? 'deviceAccent' : state === 'noData' ? 'deviceIconMuted' : 'textHint';

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityLabel={accessibilityLabel}
      accessible={accessibilityLabel !== undefined}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={centre}
          cy={centre}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={STROKE}
        />
        {state === 'value' && filled > 0 ? (
          <Circle
            cx={centre}
            cy={centre}
            r={r}
            fill="none"
            stroke={colors.deviceAccent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            // Start the arc at 12 o'clock instead of 3.
            transform={`rotate(-90 ${centre} ${centre})`}
          />
        ) : null}
      </Svg>

      <View style={styles.centre} pointerEvents="none">
        {state === 'notConnected' ? (
          <AppText variant="title" color="textHint">
            —
          </AppText>
        ) : (
          <AppIcon icon={icon} size="base" color={iconColor} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
