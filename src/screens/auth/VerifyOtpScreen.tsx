import React, { useCallback, useState } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { MailCheck } from 'lucide-react-native';
import { AppButton, AppScreen, AppText } from '@/components/common';
import { OtpInput } from '@/components/forms';
import { IconTile, ScreenHeader } from '@/components/layout';
import { API_ERROR_CODES, authMessage } from '@/domain/api/errors';
import { OTP_LENGTH, otpSchema } from '@/domain/auth/validation';
import { useKeyboardSafeNav } from '@/hooks/useKeyboardSafeNav';
import { useSignIn } from '@/hooks/useSignIn';
import { useToast } from '@/hooks/useToast';
import { spacing } from '@/theme';
import type { AuthScreenProps } from '@/types/navigation';

export function VerifyOtpScreen({
  navigation,
  route,
}: AuthScreenProps<'VerifyOtp'>) {
  const { email } = route.params;
  const { verifyOtp, submitting } = useSignIn();
  const safeNav = useKeyboardSafeNav();
  const showToast = useToast();

  const [code, setCode] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleChange = useCallback((next: string) => {
    setCode(next);
    setHasError(false);
  }, []);

  const handlePress = useCallback(async () => {
    if (submitting) {
      return;
    }

    const parsed = otpSchema.safeParse({ code });
    if (!parsed.success) {
      setHasError(true);
      showToast(
        parsed.error.issues[0]?.message ?? `Enter the ${OTP_LENGTH}-digit code`,
        'error',
      );
      return;
    }

    const result = await verifyOtp({ email, code: parsed.data.code });

    if (result.ok) {
      Keyboard.dismiss();
      showToast('Account created', 'success');
      return;
    }

    const message =
      result.error.code === API_ERROR_CODES.INVALID_OTP
        ? 'Invalid OTP'
        : authMessage(result.error);

    setHasError(true);
    showToast(message, 'error');
  }, [code, email, showToast, submitting, verifyOtp]);

  return (
    <AppScreen
      scroll
      padded="horizontal"
      centerContent
      keyboardAvoiding
      header={
        <ScreenHeader
          variant="onboarding"
          opaque={false}
          onBack={() => safeNav(navigation.goBack)}
        />
      }
    >
      <IconTile icon={MailCheck} tone="user" style={styles.brand} />

      <AppText variant="title">Enter your code</AppText>
      <AppText variant="body" color="textMuted" style={styles.subtitle}>
        We sent a {OTP_LENGTH}-digit code to {email}.
      </AppText>

      <OtpInput
        value={code}
        onChange={handleChange}
        hasError={hasError}
        editable={!submitting}
        autoFocus
      />

      <AppButton
        label="Verify"
        size={56}
        fullWidth
        loading={submitting}
        disabled={code.length < OTP_LENGTH || submitting}
        onPress={handlePress}
        style={styles.submit}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  brand: { marginBottom: spacing.xl },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.xxl },
  submit: { marginTop: spacing.xxl },
});
