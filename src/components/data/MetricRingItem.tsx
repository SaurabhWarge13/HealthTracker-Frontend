import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppButton, AppText } from '@/components/common';
import { spacing } from '@/theme';
import { ProgressRing, type RingState } from './ProgressRing';

export type MetricRingItemProps = {
  icon: LucideIcon;
  label: string;
  value?: string;
  goal?: string;
  progress?: number;
  state?: RingState;
  onAllow?: () => void;
};

export function MetricRingItem({
  icon,
  label,
  value,
  goal,
  progress = 0,
  state = 'value',
  onAllow,
}: MetricRingItemProps) {
  const accessibilityLabel =
    state === 'value'
      ? `${label}: ${value}${goal ? ` ${goal}` : ''}`
      : state === 'noData'
      ? `${label}: no data recorded yet`
      : `${label}: not connected`;

  return (
    <View style={styles.item}>
      <ProgressRing
        icon={icon}
        progress={progress}
        state={state}
        accessibilityLabel={accessibilityLabel}
      />

      <AppText
        variant="overline"
        color={state === 'notConnected' ? 'textHint' : 'textMuted'}
      >
        {label.toUpperCase()}
      </AppText>

      <View style={styles.readout}>
        {state === 'notConnected' ? (
          <>
            <AppText variant="micro" color="textHint">
              Not connected
            </AppText>
            {onAllow !== undefined ? (
              <AppButton
                label="Allow"
                variant="text"
                tone="device"
                size={32}
                onPress={onAllow}
              />
            ) : null}
          </>
        ) : (
          <>
            <AppText
              variant="statValue"
              color={state === 'noData' ? 'textHint' : 'textPrimary'}
              numeric
            >
              {state === 'noData' ? 'No data' : value}
            </AppText>
            {goal !== undefined ? (
              <AppText variant="micro" color="textHint" numeric>
                {goal}
              </AppText>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', gap: spacing.sm },
  readout: { alignItems: 'center', gap: 1 },
});
