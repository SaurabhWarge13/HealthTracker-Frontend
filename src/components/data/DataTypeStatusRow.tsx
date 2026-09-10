import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppIcon, AppText } from '@/components/common';
import { spacing } from '@/theme';
import { SourceChip, type DataSource } from './SourceChip';
import type { AppChipSize } from './AppChip';

export type DataTypeStatusRowProps = {
  label: string;
  status: DataSource;
  icon?: LucideIcon;
  /** Dim the label when the data type is off (Settings "Water"). */
  muted?: boolean;
  chipSize?: AppChipSize;
};

export function DataTypeStatusRow({
  label,
  status,
  icon,
  muted = false,
  chipSize = 'sm',
}: DataTypeStatusRowProps) {
  return (
    <View style={styles.row}>
      {icon ? <AppIcon icon={icon} size="base" color="deviceAccent" /> : null}
      <AppText
        variant="body"
        color={muted ? 'textMuted' : 'textPrimary'}
        style={styles.label}
        numberOfLines={1}
      >
        {label}
      </AppText>
      <SourceChip source={status} size={chipSize} />
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
