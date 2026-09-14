import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useController, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, Droplet, Moon, Target } from 'lucide-react-native';
import { AppButton, AppText } from '@/components/common';
import { SectionCard } from '@/components/layout';
import { GoalInputRow, OnboardingStepLayout } from '@/components/onboarding';
import { useKeyboardSafeNav } from '@/hooks';
import {
  goalOrNull,
  goalsSchema,
  hoursToMinutes,
  litresToMl,
  minutesToHours,
  mlToLitres,
  type GoalsPayload,
  type GoalsValues,
} from '@/domain/profile/validation';
import { selectOnboardingDraft } from '@/store/onboarding/onboardingSelectors';
import { goalsSaved, stepEntered } from '@/store/onboarding/onboardingSlice';
import { profileCompleted } from '@/store/profile/profileSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { spacing } from '@/theme';
import type { OnboardingScreenProps } from '@/types/navigation';

function ControlledGoalRow({
  control,
  name,
  ...rest
}: {
  control: Control<GoalsValues, unknown, GoalsPayload>;
  name: keyof GoalsValues;
} & Omit<React.ComponentProps<typeof GoalInputRow>, 'value' | 'onChangeText'>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <GoalInputRow
      value={field.value ?? ''}
      onChangeText={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
      {...rest}
    />
  );
}

export function GoalsScreen({ navigation }: OnboardingScreenProps<'Goals'>) {
  const dispatch = useAppDispatch();
  const draft = useAppSelector(selectOnboardingDraft);
  const safeNav = useKeyboardSafeNav();

  const { control, handleSubmit } = useForm<GoalsValues, unknown, GoalsPayload>({
    resolver: zodResolver(goalsSchema),
    mode: 'onTouched',
    defaultValues: {
      stepGoal: draft.stepGoal !== null ? String(draft.stepGoal) : '',
      waterGoalLitres:
        draft.waterGoalMl !== null ? String(mlToLitres(draft.waterGoalMl)) : '',
      sleepGoalHours:
        draft.sleepGoalMinutes !== null
          ? String(minutesToHours(draft.sleepGoalMinutes))
          : '',
      targetWeight:
        draft.targetWeightKg !== null ? String(draft.targetWeightKg) : '',
    },
  });

  useEffect(() => {
    dispatch(stepEntered(4));
  }, [dispatch]);

  const finish = useCallback(
    (goals: {
      stepGoal: number | null;
      waterGoalMl: number | null;
      sleepGoalMinutes: number | null;
      targetWeightKg: number | null;
    }) =>
      safeNav(() => {
        dispatch(goalsSaved(goals));

        const now = Date.now();

        dispatch(
          profileCompleted({
            name: draft.name,
            baselineWeightKg: draft.weightKg,
            heightCm: draft.heightCm,
            baselineSetAt: now,
            ...goals,
          }),
        );

      }),
    [dispatch, draft, safeNav],
  );

  const onSubmit = useCallback(
    (values: GoalsPayload) => {
      const waterLitres = goalOrNull(values.waterGoalLitres);
      const sleepHours = goalOrNull(values.sleepGoalHours);

      finish({
        stepGoal: goalOrNull(values.stepGoal),
        waterGoalMl: waterLitres === null ? null : litresToMl(waterLitres),
        sleepGoalMinutes: sleepHours === null ? null : hoursToMinutes(sleepHours),
        targetWeightKg: goalOrNull(values.targetWeight),
      });
    },
    [finish],
  );

  const skip = useCallback(
    () =>
      finish({
        stepGoal: null,
        waterGoalMl: null,
        sleepGoalMinutes: null,
        targetWeightKg: null,
      }),
    [finish],
  );

  const baselineText =
    draft.weightKg !== null ? `today's ${draft.weightKg.toFixed(1)} kg` : 'today';

  return (
    <OnboardingStepLayout
      step={4}
      title="Anything you'd like to aim for?"
      subtitle="All three are optional, and easy to change later."
      onBack={() => safeNav(navigation.goBack)}
      footer={
        <View style={styles.actions}>
          <AppButton
            label="Finish setup"
            size={56}
            fullWidth
            onPress={handleSubmit(onSubmit)}
          />
          <AppButton
            label="Skip for now"
            variant="secondary"
            size={52}
            fullWidth
            onPress={skip}
          />
        </View>
      }
    >
      <SectionCard
        icon={Target}
        tone="user"
        title="Your targets"
        subtitle="Leave any of them blank"
      >
        <View style={styles.rows}>
          <ControlledGoalRow
            control={control}
            name="stepGoal"
            icon={Activity}
            label="Daily steps"
            unit="steps"
            placeholder="8,000"
            keyboardType="number-pad"
          />
          <ControlledGoalRow
            control={control}
            name="waterGoalLitres"
            icon={Droplet}
            label="Daily water"
            unit="L"
            placeholder="2.4"
            keyboardType="decimal-pad"
          />
          <ControlledGoalRow
            control={control}
            name="sleepGoalHours"
            icon={Moon}
            label="Nightly sleep"
            unit="hours"
            placeholder="8"
            keyboardType="decimal-pad"
          />
          <ControlledGoalRow
            control={control}
            name="targetWeight"
            icon={Target}
            label="Target weight"
            unit="kg"
            placeholder="—"
            keyboardType="decimal-pad"
          />
        </View>
      </SectionCard>

      <AppText variant="micro" color="textHint" style={styles.footnote}>
        A target can sit above or below {baselineText} — whichever direction
        you're heading.
      </AppText>
    </OnboardingStepLayout>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.lg },
  footnote: { marginTop: spacing.md, marginHorizontal: 2 },
  actions: { gap: spacing.sm },
});
