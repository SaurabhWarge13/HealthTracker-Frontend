import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { AppButton, AppText } from '@/components/common';
import { IconTile } from '@/components/layout';
import { useTheme } from '@/hooks/useTheme';
import { layout, radius, spacing } from '@/theme';

export type AppDialogAction = {
  label: string;
  onPress: () => void;
  /** Renders as the danger text button. */
  destructive?: boolean;
};

export type AppDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  /** Small tinted tile above the title (6c). */
  icon?: LucideIcon;
  confirm: AppDialogAction;
  /**
   * A third choice, between the primary and Cancel. Only the stacked layout
   * has room for it — a dialog that has to offer "sync", "discard" and "back
   * out" cannot fit them on one row and stay readable.
   */
  secondary?: AppDialogAction;
  cancelLabel?: string;
  onCancel: () => void;
  /**
   * 'row' puts Cancel and the action side by side (5f);
   * 'stacked' gives the primary its own full-width row (6c).
   */
  layout?: 'row' | 'stacked';
};

export function AppDialog({
  visible,
  title,
  message,
  icon,
  confirm,
  secondary,
  cancelLabel = 'Cancel',
  onCancel,
  layout: actionLayout = 'row',
}: AppDialogProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // A destructive choice must be made, not dismissed by accident.
  const dismissible = confirm.destructive !== true;
  const handleDismiss = dismissible ? onCancel : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
          accessible={false}
        />

        <View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              marginTop: insets.top,
              marginBottom: insets.bottom,
            },
          ]}
        >
          {icon !== undefined ? (
            <IconTile icon={icon} tone="device" size={44} style={styles.icon} />
          ) : null}

          <AppText variant="cardTitle" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="bodySmall" color="textMuted" style={styles.message}>
            {message}
          </AppText>

          {actionLayout === 'row' ? (
            <View style={styles.rowActions}>
              <AppButton
                label={cancelLabel}
                variant="neutral"
                size={48}
                onPress={onCancel}
              />
              <AppButton
                label={confirm.label}
                variant="text"
                tone={confirm.destructive ? 'danger' : 'user'}
                size={48}
                onPress={confirm.onPress}
              />
            </View>
          ) : (
            <View style={styles.stackedActions}>
              <AppButton
                label={confirm.label}
                size={52}
                fullWidth
                onPress={confirm.onPress}
              />
              {secondary ? (
                <AppButton
                  label={secondary.label}
                  variant="text"
                  tone={secondary.destructive ? 'danger' : 'user'}
                  size={48}
                  fullWidth
                  onPress={secondary.onPress}
                />
              ) : null}
              <AppButton
                label={cancelLabel}
                variant="neutral"
                size={48}
                fullWidth
                onPress={onCancel}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    borderRadius: radius.dialog,
    paddingTop: 22,
    paddingHorizontal: spacing.xl - 4,
    paddingBottom: layout.cardPadding,
  },
  icon: { marginBottom: 14 },
  message: { marginTop: spacing.sm },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg + spacing.xs,
  },
  stackedActions: { gap: spacing.sm, marginTop: spacing.lg + spacing.xs },
});
