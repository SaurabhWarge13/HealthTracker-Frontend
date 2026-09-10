import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, AppText } from '@/components/common';
import { spacing } from '@/theme';

export type ConnectPromptProps = {
  onConnect: () => void;
  onDismiss: () => void;
};

export function ConnectPrompt({ onConnect, onDismiss }: ConnectPromptProps) {
  return (
    <View>
      <AppText variant="body" color="textMuted" style={styles.copy}>
        Connect Health Connect and your steps, sleep and water track themselves.
      </AppText>

      <View style={styles.actions}>
        <AppButton
          label="Connect"
          variant="deviceFilled"
          size={48}
          onPress={onConnect}
          style={styles.connect}
        />
        <AppButton
          label="Not now"
          variant="text"
          tone="muted"
          size={48}
          onPress={onDismiss}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { marginBottom: spacing.lg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  connect: { flex: 1 },
});
