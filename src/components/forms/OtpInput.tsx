import React, { useCallback, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { OTP_LENGTH } from '@/domain/auth/validation';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, text } from '@/theme';
import { AppText } from '@/components/common';

export type OtpInputProps = {
  value: string;
  onChange: (next: string) => void;
  hasError?: boolean;
  autoFocus?: boolean;
  /** Carries the code because the caller's `value` is still one digit behind. */
  onComplete?: (code: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
};

const BOX_HEIGHT = 64;

/**
 * One transparent input stretched across all the boxes, so advancing,
 * backspacing and pasting come for free. The boxes only draw `value`.
 */
export function OtpInput({
  value,
  onChange,
  hasError = false,
  autoFocus = false,
  onComplete,
  containerStyle,
}: OtpInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const handleChange = useCallback(
    (raw: string) => {
      // Some number pads still offer punctuation, and a paste carries anything.
      const digits = raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
      onChange(digits);

      if (digits.length === OTP_LENGTH) {
        onComplete?.(digits);
      }
    },
    [onChange, onComplete],
  );

  const focus = useCallback(() => inputRef.current?.focus(), []);

  return (
    <Pressable
      onPress={focus}
      accessible={false}
      style={[styles.container, containerStyle]}
    >
      <View style={styles.boxes}>
        {Array.from({ length: OTP_LENGTH }, (_unused, index) => {
          const digit = value[index];
          // The next empty box is the one the caret would be in.
          const active = index === value.length;

          return (
            <View
              key={index}
              style={[
                styles.box,
                hasError || active ? styles.boxEmphasis : styles.boxRest,
                {
                  backgroundColor: colors.surface,
                  borderColor: hasError
                    ? colors.danger
                    : active
                    ? colors.userAccent
                    : colors.border,
                },
              ]}
            >
              <AppText style={styles.digit}>{digit ?? ''}</AppText>
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoFocus={autoFocus}
        // The boxes draw the position; a real caret would sit in the wrong place.
        caretHidden
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        accessibilityLabel="Verification code"
        style={styles.input}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  boxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  box: {
    width: 56,
    height: BOX_HEIGHT,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxRest: { borderWidth: 1 },
  boxEmphasis: { borderWidth: 1.5 },
  digit: { ...text.title, letterSpacing: -0.3 },
  // Covers the boxes so a tap focuses it. Must stay mounted, or the keyboard
  // closes on every keystroke.
  input: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
