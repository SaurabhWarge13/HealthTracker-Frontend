import React, { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User } from 'lucide-react-native';
import { AppButton } from '@/components/common';
import { ControlledInput } from '@/components/forms';
import { OnboardingStepLayout } from '@/components/onboarding';
import { useKeyboardSafeNav } from '@/hooks';
import { nameSchema, type NameValues } from '@/domain/profile/validation';
import { selectOnboardingDraft } from '@/store/onboarding/onboardingSelectors';
import { nameSaved, stepEntered } from '@/store/onboarding/onboardingSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import type { OnboardingScreenProps } from '@/types/navigation';

export function NameScreen({ navigation }: OnboardingScreenProps<'Name'>) {
  const dispatch = useAppDispatch();
  const draft = useAppSelector(selectOnboardingDraft);
  const safeNav = useKeyboardSafeNav();

  const { control, handleSubmit } = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    mode: 'onTouched',
    defaultValues: { name: draft.name },
  });

  useEffect(() => {
    dispatch(stepEntered(1));
  }, [dispatch]);

  const goNext = useCallback(
    (name: string) =>
      safeNav(() => {
        dispatch(nameSaved(name));
        navigation.navigate('HealthConnect');
      }),
    [dispatch, navigation, safeNav],
  );

  const submit = handleSubmit(values => goNext(values.name));

  return (
    <OnboardingStepLayout
      step={1}
      title="What should we call you?"
      subtitle="A first name is plenty. You can change it any time."
      footer={
        <AppButton label="Continue" size={56} fullWidth onPress={submit} />
      }
    >
      <ControlledInput
        control={control}
        name="name"
        size="xl"
        leadingIcon={User}
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
    </OnboardingStepLayout>
  );
}
