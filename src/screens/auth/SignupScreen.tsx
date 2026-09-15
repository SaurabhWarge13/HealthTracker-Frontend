import React, { useCallback, useRef } from 'react';
import { Keyboard, StyleSheet, View, type TextInput } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, Lock, Mail } from 'lucide-react-native';
import { AppButton, AppScreen, AppText } from '@/components/common';
import { ControlledInput } from '@/components/forms';
import { IconTile } from '@/components/layout';
import { EMAIL_LABEL, EMAIL_PLACEHOLDER, PASSWORD_LABEL, SIGN_IN } from '@/content';
import { authMessage } from '@/domain/api/errors';
import { signupSchema, type SignupValues } from '@/domain/auth/validation';
import { useKeyboardSafeNav } from '@/hooks/useKeyboardSafeNav';
import { useSignIn } from '@/hooks/useSignIn';
import { useToast } from '@/hooks/useToast';
import { spacing } from '@/theme';
import type { AuthScreenProps } from '@/types/navigation';

const FORM_FIELDS = ['email', 'password'] as const;

export function SignupScreen({ navigation }: AuthScreenProps<'Signup'>) {
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const { signUp, submitting } = useSignIn();
  const safeNav = useKeyboardSafeNav();
  const showToast = useToast();

  const { control, handleSubmit, formState, setError } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = useCallback(
    async (values: SignupValues) => {
      const parsed = signupSchema.parse(values);

      const result = await signUp({
        email: parsed.email,
        password: parsed.password,
      });
      if (result.ok) {
        Keyboard.dismiss();
        navigation.navigate('VerifyOtp', { email: parsed.email });
        return;
      }

      if (result.error.kind === 'emailTaken') {
        setError('email', { message: authMessage(result.error) });
      }

      const { fieldErrors } = result.error;
      if (fieldErrors !== undefined) {
        for (const field of FORM_FIELDS) {
          const message = fieldErrors[field];
          if (message !== undefined) {
            setError(field, { message });
          }
        }
      }

      showToast(authMessage(result.error), 'error');
    },
    [navigation, setError, showToast, signUp],
  );

  const submit = handleSubmit(onSubmit);

  return (
    <AppScreen
      scroll
      padded
      centerContent
      keyboardAvoiding
      footerPlacement="scroll"
      footer={
        <View style={styles.footer}>
          <AppText variant="bodySmall" color="textMuted">
            Already have an account?
          </AppText>
          <AppButton
            label={SIGN_IN}
            variant="text"
            size={48}
            onPress={() => safeNav(navigation.goBack)}
          />
        </View>
      }
    >
      <IconTile icon={Activity} tone="user" style={styles.brand} />

      <AppText variant="title">Create your account</AppText>
      <AppText variant="body" color="textMuted" style={styles.subtitle}>
        A few details and your weight log is ready to go.
      </AppText>

      <ControlledInput
        control={control}
        name="email"
        label={EMAIL_LABEL}
        leadingIcon={Mail}
        placeholder={EMAIL_PLACEHOLDER}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
        editable={!submitting}
      />

      <ControlledInput
        control={control}
        name="password"
        inputRef={passwordRef}
        label={PASSWORD_LABEL}
        leadingIcon={Lock}
        placeholder="At least 8 characters"
        secureToggle
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password-new"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
        containerStyle={styles.field}
        editable={!submitting}
      />

      <ControlledInput
        control={control}
        name="confirmPassword"
        inputRef={confirmRef}
        label="Confirm password"
        leadingIcon={Lock}
        placeholder="Type it once more"
        secureToggle
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password-new"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
        containerStyle={styles.field}
        editable={!submitting}
      />

      <AppButton
        label="Create account"
        size={56}
        fullWidth
        loading={submitting}
        disabled={!formState.isValid || submitting}
        onPress={submit}
        style={styles.submit}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  brand: { marginBottom: spacing.xl },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.xxl },
  field: { marginTop: spacing.lg + spacing.xs },
  submit: { marginTop: spacing.xxl },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
