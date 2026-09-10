import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { AppDivider, AppIcon, AppText } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { layout, radius } from '@/theme';
import { IconTile, type IconTileTone } from './IconTile';

export type SectionCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tone?: IconTileTone;
  children?: React.ReactNode;
  /** Row below a second divider — "Synced 10:32 AM · Manage ›". */
  footer?: React.ReactNode;
  /** Makes the whole header tappable and shows a chevron. */
  onPress?: () => void;
  /** Custom right-hand header content (overrides the chevron). */
  headerAccessory?: React.ReactNode;
  /** Drop the body padding when the child manages its own (row lists). */
  bodyPadding?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SectionCard({
  icon,
  title,
  subtitle,
  tone = 'user',
  children,
  footer,
  onPress,
  headerAccessory,
  bodyPadding = true,
  style,
}: SectionCardProps) {
  const { colors } = useTheme();

  const header = (
    <View style={styles.header}>
      <IconTile icon={icon} tone={tone} />
      <View style={styles.headerText}>
        <AppText variant="cardTitle" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle !== undefined ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {headerAccessory ??
        (onPress !== undefined ? (
          <AppIcon icon={ChevronRight} size="base" color="textHint" />
        ) : null)}
    </View>
  );

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface }, style]}
    >
      {onPress !== undefined ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
          // No ripple: RN's bounded ripple mask is a rectangle. See AppButton.
          style={({ pressed }) => pressed && styles.pressed}
        >
          {header}
        </Pressable>
      ) : (
        header
      )}

      {children !== undefined ? (
        <>
          <AppDivider />
          <View style={bodyPadding ? styles.body : undefined}>{children}</View>
        </>
      ) : null}

      {footer !== undefined ? (
        <>
          <AppDivider />
          <View style={styles.footer}>{footer}</View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: layout.cardPadding,
  },
  headerText: { flex: 1, gap: 2 },
  body: { padding: layout.cardPadding },
  footer: { paddingVertical: 12, paddingHorizontal: layout.cardPadding },
  pressed: { opacity: 0.7 },
});
