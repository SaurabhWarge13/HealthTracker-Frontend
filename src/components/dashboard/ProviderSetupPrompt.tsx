import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, AppText } from '@/components/common';
import type { ProviderIssue } from '@/domain/healthConnect/provider';
import { spacing } from '@/theme';

export type ProviderSetupPromptProps = {
  issue: ProviderIssue;
  onAction: () => void;
};

/** Says what is wrong before what to do about it, so the button is no surprise. */
const COPY: Record<ProviderIssue, { body: string; action: string }> = {
  missing: {
    body: "Health Connect isn't installed on this phone. Get it free and your steps, sleep and water track themselves.",
    action: 'Get Health Connect',
  },
  disabled: {
    body: 'Health Connect is turned off on this phone. Turn it back on and your steps, sleep and water track themselves.',
    action: 'Open settings',
  },
  updateRequired: {
    body: 'Health Connect needs an update before this app can read your steps, sleep and water.',
    action: 'Update Health Connect',
  },
};

export function ProviderSetupPrompt({ issue, onAction }: ProviderSetupPromptProps) {
  const copy = COPY[issue];

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
