import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { AppIcon, AppText } from '@/components/common';
import { layout, spacing, type ColorName } from '@/theme';

export type ListRowProps = {
  label: string;
  /** Omitted for rows that only navigate (Privacy policy). */
  value?: string;
  /** Dim the value when nothing is set yet ("Not set"). */
  valueMuted?: boolean;
  leadingIcon?: LucideIcon;
  /** Replaces the chevron — a chip, a link, anything the artboard shows. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Chevron for pushes, external-link glyph for leaving the app. */
  chevronIcon?: LucideIcon;
  labelColor?: ColorName;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({
  label,
  value,
  valueMuted = false,
  leadingIcon,
  trailing,
  onPress,
  chevronIcon,
  labelColor = 'textMuted',
  style,
}: ListRowProps) {
  const interactive = onPress !== undefined;

  const content = (
    <>
      {leadingIcon ? (
        <AppIcon icon={leadingIcon} size="base" color="textHint" />
      ) : null}

      <AppText variant="body" color={labelColor} style={styles.label} numberOfLines={1}>
        {label}
      </AppText>

      {value !== undefined ? (
        <AppText
          variant="body"
          color={valueMuted ? 'textHint' : 'textPrimary'}
          numberOfLines={1}
        >
          {value}
        </AppText>
      ) : null}

      {trailing}

      {trailing === undefined && interactive ? (
        <AppIcon icon={chevronIcon ?? ChevronRight} size="base" color="textHint" />
      ) : null}
    </>
  );

  if (!interactive) {
    return <View style={[styles.row, style]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value !== undefined ? `${label}, ${value}` : label}
      // No ripple: RN's bounded ripple mask is a rectangle. See AppButton.
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTapTarget,
  },
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
