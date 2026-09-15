import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, AppText } from '@/components/common';
import { PROVIDER_SETUP_COPY } from '@/content';
import type { ProviderIssue } from '@/domain/healthConnect/provider';
import { spacing } from '@/theme';

export type ProviderSetupPromptProps = {
  issue: ProviderIssue;
  onAction: () => void;
};

export function ProviderSetupPrompt({ issue, onAction }: ProviderSetupPromptProps) {
  const copy = PROVIDER_SETUP_COPY[issue];

  return (
    <View>
      <AppText variant="body" color="textMuted" style={styles.copy}>
        {copy.body}
      </AppText>

      <View style={styles.actions}>
        <AppButton
          label={copy.action}
          variant="deviceFilled"
          size={48}
          onPress={onAction}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { marginBottom: spacing.lg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  action: { flex: 1 },
});
