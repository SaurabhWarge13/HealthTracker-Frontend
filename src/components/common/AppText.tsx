import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import {
  numeric as numericStyle,
  text,
  type ColorName,
  type TextVariant,
} from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: ColorName;
  numeric?: boolean;
  align?: TextStyle['textAlign'];
};

const MAX_FONT_SCALE = 1.3;

export function AppText({
  variant = 'body',
  color = 'textPrimary',
  numeric = false,
  align,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();

  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        text[variant],
        { color: colors[color] },
        numeric && numericStyle,
        align !== undefined && { textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
