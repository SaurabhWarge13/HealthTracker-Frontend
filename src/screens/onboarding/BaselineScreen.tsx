import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, Info } from 'lucide-react-native';
import { AppButton, InlineNote } from '@/components/common';
import { MeasurementField } from '@/components/checkins';
import { OnboardingStepLayout } from '@/components/onboarding';
import { useKeyboardSafeNav } from '@/hooks';
import { ACTION_LABEL, FIELD_LABEL, UNIT } from '@/content';
import {
  baselineSchema,
  type BaselinePayload,
  type BaselineValues,
} from '@/domain/profile/validation';
import { isWeightUsable } from '@/domain/healthConnect/freshness';
import {
  selectHealthConnectStatus,
  selectHealthConnectUsable,
  selectTodayReadings,
} from '@/store/healthConnect/healthConnectSelectors';
import { selectOnboardingDraft } from '@/store/onboarding/onboardingSelectors';
import { baselineSaved, stepEntered } from '@/store/onboarding/onboardingSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { spacing } from '@/theme';
import type { OnboardingScreenProps } from '@/types/navigation';

export function BaselineScreen({ navigation }: OnboardingScreenProps<'Baseline'>) {
  const dispatch = useAppDispatch();
  const draft = useAppSelector(selectOnboardingDraft);
  const readings = useAppSelector(selectTodayReadings);
  const heightRef = useRef<TextInput>(null);
  const safeNav = useKeyboardSafeNav();

  const connected = useAppSelector(selectHealthConnectUsable);
  const hcStatus = useAppSelector(selectHealthConnectStatus);
  const hcChecked = useAppSelector(state => state.healthConnect.hasChecked);

  const canConnect = hcChecked && hcStatus === 'NOT_CONNECTED';

  const prefill = useRef({
    weight:
      connected && isWeightUsable(readings.weightRecordedAt, Date.now())
        ? String(readings.weightKg ?? '')
        : '',
    height: connected && readings.heightCm !== null ? String(readings.heightCm) : '',
  }).current;

  const weightFromDevice = connected && prefill.weight !== '';
  const heightFromDevice = connected && prefill.height !== '';

  const { control, handleSubmit, formState } = useForm<
    BaselineValues,
    unknown,
    BaselinePayload
  >({
    resolver: zodResolver(baselineSchema),
    mode: 'onTouched',
    defaultValues: {
      weight: draft.weightKg !== null ? String(draft.weightKg) : prefill.weight,
      height: draft.heightCm !== null ? String(draft.heightCm) : prefill.height,
    },
  });

  useEffect(() => {
    dispatch(stepEntered(3));
  }, [dispatch]);

  const onSubmit = useCallback(
    (values: BaselinePayload) =>
      safeNav(() => {
        dispatch(
          baselineSaved({ weightKg: values.weight, heightCm: values.height }),
        );
        navigation.navigate('Goals');
      }),
    [dispatch, navigation, safeNav],
  );

  const submit = handleSubmit(onSubmit);

  return (
    <OnboardingStepLayout
      step={3}
      title="Where are you starting from?"
      subtitle={
        weightFromDevice || heightFromDevice
          ? 'We pulled these across. Edit anything that looks off.'
          : undefined
      }
      onBack={() => safeNav(navigation.goBack)}
      footer={
        <AppButton
          label={ACTION_LABEL.continue}
          size={56}
          fullWidth
          disabled={!formState.isValid}
          onPress={submit}
        />
      }
    >
      {canConnect ? (
        <InlineNote icon={Info} variant="bodySmall" style={styles.note}>
          Health Connect isn't connected, so enter these yourself.
        </InlineNote>
      ) : connected && !weightFromDevice && !heightFromDevice ? (
        <InlineNote icon={Activity} variant="bodySmall" style={styles.note}>
          Health Connect is connected, but it has no recent weight or height —
          enter them here and it will fill in the rest.
        </InlineNote>
      ) : null}

      <MeasurementField
        control={control}
        name="weight"
        label={FIELD_LABEL.weight}
        source={weightFromDevice ? 'healthConnect' : undefined}
        suffix={UNIT.kg}
        placeholder="72.4"
        returnKeyType="next"
        onSubmitEditing={() => heightRef.current?.focus()}
        submitBehavior="submit"
      />

      <View style={styles.heightBlock}>
        <MeasurementField
          control={control}
          name="height"
          inputRef={heightRef}
          label={FIELD_LABEL.height}
          source={heightFromDevice ? 'healthConnect' : undefined}
          suffix={UNIT.cm}
          placeholder="168"
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={submit}
          helper="We use this to show your BMI."
        />
      </View>

      {canConnect ? (
        <AppButton
          label="Connect Health Connect instead"
          variant="deviceTint"
          size={52}
          fullWidth
          icon={Activity}
          onPress={() => safeNav(() => navigation.navigate('HealthConnect'))}
          style={styles.connectInstead}
        />
      ) : null}
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  note: { marginBottom: spacing.xl + spacing.xs },
  heightBlock: { marginTop: spacing.xl },
  connectInstead: { marginTop: spacing.xl },
});
