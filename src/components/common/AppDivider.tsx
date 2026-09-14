import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type AppDividerProps = {
  inset?: 0 | 32 | 48;
  style?: StyleProp<ViewStyle>;
};

export function AppDivider({ inset = 0, style }: AppDividerProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.border, marginLeft: inset },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { height: StyleSheet.hairlineWidth },
});
