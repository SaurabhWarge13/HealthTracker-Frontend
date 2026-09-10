import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { AppIcon, AppText } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

export type StatTileProps = {
  label: string;
  /** The measurement. Ignored by the invite variant. */
  value?: string;
  /** Turns the tile into a call to action. */
  invite?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
};

export function StatTile({ label, value, invite, style }: StatTileProps) {
  const { colors } = useTheme();

  if (invite) {
    return (
      <Pressable
        onPress={invite.onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${invite.label}`}
        // No ripple: RN's bounded ripple mask is a rectangle. See AppButton.
        style={({ pressed }) => [
          styles.tile,
          styles.inviteTile,
          {
            backgroundColor: pressed ? colors.userTintPressed : colors.userTint,
            borderColor: colors.userChart,
          },
          style,
        ]}
      >
        <AppText variant="micro" color="userAccent">
          {label}
        </AppText>
        <View style={styles.inviteRow}>
          <AppText variant="bodySmallStrong" color="userAccent">
            {invite.label}
          </AppText>
          <AppIcon icon={ChevronRight} size="sm" color="userAccent" />
        </View>
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.tile, { backgroundColor: colors.surfaceTint }, style]}
      accessibilityLabel={`${label}, ${value}`}
    >
      <AppText variant="micro" color="textMuted">
        {label}
      </AppText>
      <AppText variant="bodyStrong" numeric>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: radius.inner,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 3,
  },
  inviteTile: {
    // Wider than its siblings because "Add height" needs the room (3e).
    flex: 1.35,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
