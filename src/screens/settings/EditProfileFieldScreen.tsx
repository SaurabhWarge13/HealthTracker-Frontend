import React, { useCallback } from 'react';
import { StyleSheet, View, type KeyboardTypeOptions } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react-native';
import { AppButton, AppScreen, AppText } from '@/components/common';
import { MeasurementField } from '@/components/checkins';
import { ScreenHeader, StickyFooter } from '@/components/layout';
import {
  goalOrNull,
  heightField,
  hoursToMinutes,
  litresToMl,
  minutesToHours,
  mlToLitres,
  optionalSleepGoalHoursField,
  optionalStepGoalField,
  optionalTargetWeightField,
  optionalWaterGoalLitresField,
  weightField,
} from '@/domain/profile/validation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectProfile } from '@/store/profile/profileSelectors';
import { profileEdited, type ProfileState } from '@/store/profile/profileSlice';
import { spacing } from '@/theme';
import type { EditableProfileField, MainStackScreenProps } from '@/types/navigation';

type FieldConfig = {
  title: string;
  label: string;
  suffix: string;
  placeholder: string;
  keyboardType: KeyboardTypeOptions;
  optional: boolean;
  /** Zod for the single `value` input: text in, parsed number out. */
  schema: z.ZodType<number | undefined, string>;
  /** Current value as the text the field should open with. */
  read: (profile: ProfileState) => string;
  /** Parsed value back into a profile patch. */
  write: (value: number | undefined) => Partial<ProfileState>;
  /** Why this number matters, in the app's voice. */
  helper?: string;
};

const text = (value: number | null): string => (value === null ? '' : String(value));

const CONFIG: Record<EditableProfileField, FieldConfig> = {
  baselineWeight: {
    title: 'Baseline weight',
    label: 'Baseline weight',
    suffix: 'kg',
    placeholder: '76.5',
    keyboardType: 'decimal-pad',
    optional: false,
    schema: weightField,
    read: profile => text(profile.baselineWeightKg),
    write: value => ({ baselineWeightKg: value ?? null }),
    // Every "since you started" figure is measured from this, so changing it
    // moves them all. Better said out loud than discovered on the dashboard.
    helper: 'Every change is measured from here, so your progress will recalculate.',
  },
  height: {
    title: 'Height',
    label: 'Height',
    suffix: 'cm',
    placeholder: '175',
    keyboardType: 'number-pad',
    // Onboarding requires it, so it can be changed here but not blanked out.
    optional: false,
    schema: heightField,
    read: profile => text(profile.heightCm),
    write: value => ({ heightCm: value ?? null }),
    helper: 'We use this to show your BMI.',
  },
  stepGoal: {
    title: 'Daily steps',
    label: 'Daily step goal',
    suffix: 'steps',
    placeholder: '10,000',
    keyboardType: 'number-pad',
    optional: true,
    schema: optionalStepGoalField,
    read: profile => text(profile.stepGoal),
    write: value => ({ stepGoal: goalOrNull(value) }),
    helper: 'Leave it blank and the ring just shows the count.',
  },
  waterGoal: {
    title: 'Daily water',
    label: 'Daily water goal',
    suffix: 'L',
    placeholder: '2.5',
    keyboardType: 'decimal-pad',
    optional: true,
    schema: optionalWaterGoalLitresField,
    // Entered in litres, stored in millilitres.
    read: profile =>
      profile.waterGoalMl === null ? '' : String(mlToLitres(profile.waterGoalMl)),
    write: value => {
      const litres = goalOrNull(value);
      return { waterGoalMl: litres === null ? null : litresToMl(litres) };
    },
  },
  sleepGoal: {
    title: 'Nightly sleep',
    label: 'Nightly sleep goal',
    suffix: 'hours',
    placeholder: '8',
    keyboardType: 'decimal-pad',
    optional: true,
    schema: optionalSleepGoalHoursField,
    // Entered in hours, stored in minutes so it matches a check-in.
    read: profile =>
      profile.sleepGoalMinutes === null
        ? ''
        : String(minutesToHours(profile.sleepGoalMinutes)),
    write: value => {
      const hours = goalOrNull(value);
      return { sleepGoalMinutes: hours === null ? null : hoursToMinutes(hours) };
    },
    helper: 'Leave it blank and the ring just shows what you slept.',
  },
  targetWeight: {
    title: 'Target weight',
    label: 'Target weight',
    suffix: 'kg',
    placeholder: '70.0',
    keyboardType: 'decimal-pad',
    optional: true,
    schema: optionalTargetWeightField,
    read: profile => text(profile.targetWeightKg),
    write: value => ({ targetWeightKg: value ?? null }),
    // Nothing in this app assumes down is good.
    helper: 'A target can sit above or below where you are now.',
  },
};

type EditValues = { value: string };
type EditPayload = { value?: number };

export function EditProfileFieldScreen({
  navigation,
  route,
}: MainStackScreenProps<'EditProfileField'>) {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectProfile);
  const config = CONFIG[route.params.field];

  const { control, handleSubmit, formState } = useForm<
    EditValues,
    unknown,
    EditPayload
  >({
    resolver: zodResolver(z.object({ value: config.schema })),
    mode: 'onTouched',
    defaultValues: { value: config.read(profile) },
  });

  const onSubmit = useCallback(
    (values: EditPayload) => {
      dispatch(profileEdited(config.write(values.value)));
      navigation.goBack();
    },
    [config, dispatch, navigation],
  );

  const submit = handleSubmit(onSubmit);

  return (
    <AppScreen
      scroll
      padded="horizontal"
      keyboardAvoiding
      header={
        <ScreenHeader
          variant="modal"
          title={config.title}
          backIcon={X}
          backAccessibilityLabel="Close"
          onBack={navigation.goBack}
        />
      }
      footer={
        <StickyFooter>
          <AppButton
            label="Save"
            size={52}
            fullWidth
            disabled={!formState.isValid}
            onPress={submit}
          />
        </StickyFooter>
      }
    >
      <View style={styles.body}>
        <MeasurementField
          control={control}
          name="value"
          label={config.label}
          optional={config.optional}
          suffix={config.suffix}
          placeholder={config.placeholder}
          keyboardType={config.keyboardType}
          returnKeyType="done"
          onSubmitEditing={submit}
          autoFocus
          helper={config.helper}
        />

        {config.optional ? (
          <AppText variant="micro" color="textHint" style={styles.clearNote}>
            Clear the field to remove it.
          </AppText>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: spacing.xl },
  clearNote: { marginTop: spacing.md, marginHorizontal: 2 },
});
