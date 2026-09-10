import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Activity, X } from 'lucide-react-native';
import { AppButton, AppIconButton, InlineBanner } from '@/components/common';
import { spacing } from '@/theme';
import { formatTime, formatWeightWithUnit } from '@/utils/formatters';

export type WeightNudgeBannerProps = {
  weightKg: number;
  recordedAt: number;
  onCheckIn: () => void;
  onDismiss: () => void;
};

export function WeightNudgeBanner({
  weightKg,
  recordedAt,
  onCheckIn,
  onDismiss,
}: WeightNudgeBannerProps) {
  return (
    <InlineBanner
      icon={Activity}
      tone="device"
      title="Health Connect has a newer weight"
      detail={`${formatWeightWithUnit(weightKg)}, recorded ${formatTime(recordedAt)}`}
      trailing={
        <View style={styles.actions}>
          <AppButton label="Check in" size={32} onPress={onCheckIn} />
          <AppIconButton
            icon={X}
            onPress={onDismiss}
            accessibilityLabel="Dismiss this reading"
            size={28}
            iconSize="md"
            color="textHint"
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
