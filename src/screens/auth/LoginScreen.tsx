import React, { useCallback, useRef } from 'react';
import { Keyboard, StyleSheet, View, type TextInput } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, Clock, Lock, Mail } from 'lucide-react-native';
import {
  AppButton,
  AppScreen,
  AppText,
  InlineBanner,
} from '@/components/common';
import { ControlledInput } from '@/components/forms';
import { IconTile } from '@/components/layout';
import { EMAIL_LABEL, EMAIL_PLACEHOLDER, PASSWORD_LABEL, SIGN_IN } from '@/content';
import { authMessage } from '@/domain/api/errors';
import { loginSchema, type LoginValues } from '@/domain/auth/validation';
import { useKeyboardSafeNav } from '@/hooks/useKeyboardSafeNav';
import { useSignIn } from '@/hooks/useSignIn';
import { useToast } from '@/hooks/useToast';
import { spacing } from '@/theme';
import { expiryAcknowledged } from '@/store/auth/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import type { AuthScreenProps } from '@/types/navigation';

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const dispatch = useAppDispatch();
  const passwordRef = useRef<TextInput>(null);
  const { signIn, submitting } = useSignIn();
  const safeNav = useKeyboardSafeNav();
  const showToast = useToast();
  const expiredReason = useAppSelector(state => state.auth.expiredReason);

  const { control, handleSubmit, formState, setError } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = useCallback(
    async (values: LoginValues) => {
      dispatch(expiryAcknowledged());

      const result = await signIn({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      if (result.ok) {
        Keyboard.dismiss();
        showToast('Welcome back', 'success');
        return;
      }

      const { fieldErrors } = result.error;
      if (fieldErrors !== undefined) {
        for (const [field, message] of Object.entries(fieldErrors)) {
          if (field === 'email' || field === 'password') {
            setError(field, { message });
          }
        }
      }

      showToast(authMessage(result.error), 'error');
    },
    [dispatch, setError, showToast, signIn],
  );

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
            New here?
          </AppText>
          <AppButton
            label="Create an account"
            variant="text"
            size={48}
            onPress={() => safeNav(() => navigation.navigate('Signup'))}
          />
        </View>
      }
    >
      <IconTile icon={Activity} tone="user" style={styles.brand} />

      <AppText variant="title">Welcome back</AppText>
      <AppText variant="body" color="textMuted" style={styles.subtitle}>
        Sign in to pick up your weight log and check-ins.
      </AppText>

      {expiredReason !== null ? (
        <InlineBanner
          icon={Clock}
          title={expiredReason}
          detail="Your check-ins are still on this device."
          style={styles.notice}
        />
      ) : null}

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
      />

      <ControlledInput
        control={control}
        name="password"
        inputRef={passwordRef}
        label={PASSWORD_LABEL}
        leadingIcon={Lock}
        placeholder="Your password"
        secureToggle
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={handleSubmit(onSubmit)}
        containerStyle={styles.password}
      />

      <AppButton
        label={SIGN_IN}
        size={56}
        fullWidth
        loading={submitting}
        disabled={!formState.isValid || submitting}
        onPress={handleSubmit(onSubmit)}
        style={styles.submit}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  brand: { marginBottom: spacing.xl },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.xxl },
  notice: { marginBottom: spacing.lg + spacing.xs },
  password: { marginTop: spacing.lg + spacing.xs },
  submit: { marginTop: spacing.xxl },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
