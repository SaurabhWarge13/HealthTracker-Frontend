import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { spacing, type ColorName, type TextVariant } from '@/theme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

export type InlineNoteProps = {
  icon: LucideIcon;
  children: string;
  variant?: TextVariant;
  color?: ColorName;
  iconColor?: ColorName;
  style?: StyleProp<ViewStyle>;
};

export function InlineNote({
  icon,
  children,
  variant = 'caption',
  color = 'textMuted',
  iconColor = 'textHint',
  style,
}: InlineNoteProps) {
  return (
    <View style={[styles.row, style]}>
      <AppIcon icon={icon} size="base" color={iconColor} />
      <AppText variant={variant} color={color} style={styles.text}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  text: { flex: 1 },
});
