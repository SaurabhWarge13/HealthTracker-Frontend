import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Activity, Droplet, Lock, Moon } from 'lucide-react-native';
import { AppButton, InlineNote } from '@/components/common';
import { DataTypeStatusRow } from '@/components/data';
import { SectionCard } from '@/components/layout';
import { OnboardingStepLayout } from '@/components/onboarding';
import { useHealthConnect } from '@/hooks';
import { healthConnectChosen, stepEntered } from '@/store/onboarding/onboardingSlice';
import { useAppDispatch } from '@/store/hooks';
import { spacing } from '@/theme';
import type { OnboardingScreenProps } from '@/types/navigation';

const DATA_TYPES = [
  { label: 'Steps', icon: Activity },
  { label: 'Sleep', icon: Moon },
  { label: 'Water', icon: Droplet },
] as const;

export function HealthConnectScreen({
  navigation,
}: OnboardingScreenProps<'HealthConnect'>) {
  const dispatch = useAppDispatch();
  const { connect, refresh, syncing } = useHealthConnect();

  useEffect(() => {
    dispatch(stepEntered(2));
    /**
     * A silent read — `refresh` never prompts. Knowing what the device
     * actually holds before the user chooses is what lets step 3 tell
     * "declined" apart from "never asked", and stops it offering to connect
     * something that is already connected from a previous install.
     */
    refresh();
  }, [dispatch, refresh]);

  const skip = useCallback(() => {
    dispatch(healthConnectChosen('skipped'));
    navigation.navigate('Baseline');
  }, [dispatch, navigation]);

  /**
   * Shows the real Android permission sheet, then advances either way. A
   * denial is a choice, not a failure: we record what was actually granted
   * so step 3 renders the truth rather than what the user intended, and we
   * never block the flow on the answer.
   */
  const handleConnect = useCallback(async () => {
    const status = await connect();
    // NOT_SUPPORTED counts as connected here on purpose: step 3 must not
    // offer "Connect Health Connect instead" on a device that has none.
    // Only an outright refusal sends the user down the manual-entry path.
    dispatch(healthConnectChosen(status === 'NOT_CONNECTED' ? 'skipped' : 'connect'));
    navigation.navigate('Baseline');
  }, [connect, dispatch, navigation]);

  return (
    <OnboardingStepLayout
      step={2}
      title="Let your phone fill in the easy stuff"
      subtitle="Health Connect already has your steps, sleep and water. Allow reading it and you won't have to type them in."
      onBack={navigation.goBack}
      footer={
        <View style={styles.actions}>
          <AppButton
            label="Connect Health Connect"
            size={56}
            fullWidth
            loading={syncing}
            onPress={handleConnect}
          />
          <AppButton
            label="Skip for now"
            variant="secondary"
            size={52}
            fullWidth
            disabled={syncing}
            onPress={skip}
          />
        </View>
      }
    >
      <SectionCard
        icon={Activity}
        tone="device"
        title="Health Connect"
        subtitle="Read-only access, 3 data types"
      >
        <View style={styles.rows}>
          {DATA_TYPES.map(type => (
            <DataTypeStatusRow
              key={type.label}
              icon={type.icon}
              label={type.label}
              status="automatic"
            />
          ))}
        </View>
      </SectionCard>

      <InlineNote icon={Lock} style={styles.note}>
        We only read. Nothing is ever written back to Health Connect.
      </InlineNote>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 14 },
  note: { marginTop: spacing.lg, marginHorizontal: 2 },
  actions: { gap: spacing.sm },
});
