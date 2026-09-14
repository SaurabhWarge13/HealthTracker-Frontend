import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppIcon, AppInput, AppText, type AppInputProps } from '@/components/common';
import { spacing } from '@/theme';

export type GoalInputRowProps = Omit<AppInputProps, 'size' | 'label'> & {
  icon: LucideIcon;
  label: string;
  unit: string;
};

export function GoalInputRow({ icon, label, unit, ...inputProps }: GoalInputRowProps) {
  return (
    <View style={styles.row}>
      <AppIcon icon={icon} size="base" color="userAccent" />
      <AppText variant="body" style={styles.label} numberOfLines={1}>
        {label}
      </AppText>
      <AppInput
        size="inline"
        accessibilityLabel={label}
        trailing={
          <AppText variant="label" color="textHint">
            {unit}
          </AppText>
        }
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: { flex: 1 },
});
