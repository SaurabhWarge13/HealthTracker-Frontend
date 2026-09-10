import React, { useCallback, useState } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { MailCheck } from 'lucide-react-native';
import { AppButton, AppScreen, AppText } from '@/components/common';
import { OtpInput } from '@/components/forms';
import { IconTile, ScreenHeader } from '@/components/layout';
import { API_ERROR_CODES, authMessage } from '@/domain/api/errors';
import { OTP_LENGTH, otpSchema } from '@/domain/auth/validation';
import { useSignIn } from '@/hooks/useSignIn';
import { useToast } from '@/hooks/useToast';
import { spacing } from '@/theme';
import type { AuthScreenProps } from '@/types/navigation';

// Signup only parks the credentials; the account is created here, which is
// why this screen and not Signup is what starts the session.
export function VerifyOtpScreen({
  navigation,
  route,
}: AuthScreenProps<'VerifyOtp'>) {
  const { email } = route.params;
  const { verifyOtp, submitting } = useSignIn();
  const showToast = useToast();

  const [code, setCode] = useState('');
  // Only drives the boxes' red border; the message itself lives in the toast.
  const [hasError, setHasError] = useState(false);

  const handleChange = useCallback((next: string) => {
    setCode(next);
    setHasError(false);
  }, []);

  // Verification only ever runs from the button — a full code is not on its own
  // a signal that the user is done typing.
  const handlePress = useCallback(async () => {
    // Repeated taps can both land; one request per code.
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
      // Nothing to navigate to: `sessionStarted` already swapped the stack.
      // The toast host sits above both, so this survives the transition.
      Keyboard.dismiss();
      showToast('Account created', 'success');
      return;
    }

    // A wrong code gets its own wording; anything else (offline, server down)
    // keeps the message that actually describes what happened.
    const message =
      result.error.code === API_ERROR_CODES.INVALID_OTP
        ? 'Invalid OTP'
        : authMessage(result.error);

    // The keyboard stays up so a mistyped digit is one tap to fix.
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
          onBack={navigation.goBack}
        />
      }
    >
      <IconTile icon={MailCheck} tone="user" style={styles.brand} />

      <AppText variant="title">Enter your code</AppText>
      <AppText variant="body" color="textMuted" style={styles.subtitle}>
        We sent a {OTP_LENGTH}-digit code to {email}.
      </AppText>

      <OtpInput value={code} onChange={handleChange} hasError={hasError} autoFocus />

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
