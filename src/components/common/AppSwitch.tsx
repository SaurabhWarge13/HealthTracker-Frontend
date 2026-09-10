import React from 'react';
import { Switch } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type AppSwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Required: the row's label is not read out with the switch. */
  accessibilityLabel: string;
  disabled?: boolean;
};

export function AppSwitch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
}: AppSwitchProps) {
  const { colors } = useTheme();

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: colors.border, true: colors.userAccent }}
      thumbColor={colors.surface}
      ios_backgroundColor={colors.border}
    />
  );
}
