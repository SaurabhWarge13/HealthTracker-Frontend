import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { layout, spacing } from '@/theme';

export type StickyFooterProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function StickyFooter({ children, style }: StickyFooterProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xs,
  },
});
