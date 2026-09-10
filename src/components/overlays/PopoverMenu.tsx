import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppDivider, AppIcon, AppText } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { layout, radius, spacing, type ColorName } from '@/theme';

export type PopoverAnchor = { x: number; y: number; width: number; height: number };

export type PopoverMenuItem = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  destructive?: boolean;
};

export type PopoverMenuProps = {
  visible: boolean;
  /** Window-space rect of the button that opened the menu. */
  anchor: PopoverAnchor | null;
  items: PopoverMenuItem[];
  onDismiss: () => void;
};

const MENU_WIDTH = 184;
const EDGE_MARGIN = spacing.md;

export function PopoverMenu({ visible, anchor, items, onDismiss }: PopoverMenuProps) {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  // Right-align to the anchor, then keep the whole menu on screen.
  const right = anchor
    ? Math.max(EDGE_MARGIN, screenWidth - (anchor.x + anchor.width))
    : EDGE_MARGIN;
  const top = anchor ? anchor.y + anchor.height + spacing.xs : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessible={false}>
        <View
          accessibilityRole="menu"
          style={[
            styles.menu,
            isDark ? styles.shadowDark : styles.shadowLight,
            // Elevation alone is invisible on a dark surface, so add an edge.
            isDark ? styles.darkEdge : styles.noEdge,
            {
              top,
              right,
              backgroundColor: colors.surface,
              shadowColor: colors.textPrimary,
              borderColor: colors.border,
            },
          ]}
        >
          {items.map((item, index) => {
            const tone: ColorName = item.destructive ? 'danger' : 'textPrimary';
            return (
              <View key={item.label}>
                {index > 0 ? <AppDivider /> : null}
                <Pressable
                  onPress={item.onPress}
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                  // No ripple: RN masks it to a rectangle. See AppButton.
                  style={({ pressed }) => [
                    styles.item,
                    pressed && { backgroundColor: colors.surfaceNeutral },
                  ]}
                >
                  <AppIcon
                    icon={item.icon}
                    size="base"
                    color={item.destructive ? 'danger' : 'textMuted'}
                  />
                  <AppText variant="body" color={tone}>
                    {item.label}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
  shadowLight: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  shadowDark: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
  darkEdge: { borderWidth: StyleSheet.hairlineWidth },
  noEdge: { borderWidth: 0 },
  item: {
    minHeight: layout.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: layout.cardPadding,
  },
});
