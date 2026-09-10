import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppButton, AppIcon, AppText } from '@/components/common';
import { spacing } from '@/theme';
import { SourceChip, type DataSource } from './SourceChip';

export type MeasurementRowProps = {
  icon: LucideIcon;
  label: string;
  /** Formatted with its unit, e.g. "8,421" or "7h 20m" or "175 cm". */
  value: string;
  /** Where the number came from. Omitted when there is nothing to say. */
  source?: DataSource;
  /** Inline action instead of a chip — the form's "Change" link. */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function MeasurementRow({
  icon,
  label,
  value,
  source,
  actionLabel,
  onAction,
  style,
}: MeasurementRowProps) {
  return (
    <View style={[styles.row, style]} accessibilityLabel={`${label}, ${value}`}>
      <AppIcon icon={icon} size="base" color="textHint" />

      <AppText variant="body" color="textMuted" style={styles.label} numberOfLines={1}>
        {label}
      </AppText>

      <AppText variant="body" numeric numberOfLines={1}>
        {value}
      </AppText>

      {source !== undefined ? <SourceChip source={source} /> : null}

      {actionLabel !== undefined && onAction !== undefined ? (
        <AppButton
          label={actionLabel}
          variant="text"
          size={48}
          onPress={onAction}
          accessibilityLabel={`Change ${label.toLowerCase()}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: { flex: 1 },
});
