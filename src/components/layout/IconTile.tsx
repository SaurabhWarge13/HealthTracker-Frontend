import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppIcon, type AppIconSize } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { radius, type ColorName } from '@/theme';

export type IconTileTone = 'user' | 'device' | 'neutral';

export type IconTileProps = {
  icon: LucideIcon;
  tone?: IconTileTone;
  /** 34 in card headers (default); 44 in dialogs. */
  size?: 34 | 44;
  iconSize?: AppIconSize;
  style?: StyleProp<ViewStyle>;
};

const BACKGROUND: Record<IconTileTone, ColorName> = {
  user: 'userAccent',
  device: 'deviceAccent',
  neutral: 'statusUnknown',
};

export function IconTile({
  icon,
  tone = 'user',
  size = 34,
  iconSize = 'base',
  style,
}: IconTileProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size === 44 ? radius.inner : radius.tile,
          backgroundColor: colors[BACKGROUND[tone]],
        },
        style,
      ]}
    >
      <AppIcon icon={icon} size={iconSize} color="textOnAccent" />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
