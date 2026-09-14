import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '@/hooks/useTheme';
import { radius, type ColorName, type TextVariant } from '@/theme';

export type AvatarProps = {
  name: string;
  size?: 44 | 64;
  background?: ColorName;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({
  name,
  size = 44,
  background = 'userTint',
  style,
}: AvatarProps) {
  const { colors } = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const variant: TextVariant = size === 64 ? 'title' : 'cardTitle';

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, backgroundColor: colors[background] },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppText variant={variant} color="userAccent">
        {initial}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
