import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { EmptyState } from '@/components/common';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

export type CheckInMissingCardProps = {
  onBackToHistory: () => void;
};

export function CheckInMissingCard({ onBackToHistory }: CheckInMissingCardProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.centre}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <EmptyState
          icon={Search}
          dashed
          title="This check-in no longer exists"
          message="It was probably deleted. Everything else in your history is untouched."
          actionLabel="Back to History"
          onAction={onBackToHistory}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: 'center' },
  card: {
    borderRadius: radius.card,
    paddingVertical: 36,
    paddingHorizontal: spacing.xl,
  },
});
