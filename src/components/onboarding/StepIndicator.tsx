import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';

export type StepIndicatorProps = {
  /** 1-based. */
  current: number;
  total?: number;
  style?: StyleProp<ViewStyle>;
};

export function StepIndicator({ current, total = 4, style }: StepIndicatorProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.segment,
            {
              backgroundColor:
                index < current ? colors.userAccent : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});
