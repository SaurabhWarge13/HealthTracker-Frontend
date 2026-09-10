import React, { forwardRef, useCallback, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { radius, scaleFont, spacing, text } from '@/theme';
import { AppIcon } from './AppIcon';
import { AppIconButton } from './AppIconButton';
import { AppText } from './AppText';

export type AppInputSize = 'inline' | 'md' | 'lg' | 'xl';

/** How the typed value is set: normal body text, or a big bold number. */
export type AppInputValueSize = 'body' | 'display';

export type AppInputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  /** Sits beside the label — the "Optional" chip on artboards 1d/1e. */
  labelBadge?: React.ReactNode;
  /** Right-hand end of the label row — the source chip on 1d/4a. */
  labelRight?: React.ReactNode;
  /**
   * inline 48 (compact, tinted, right-aligned — goal rows)
   * md 56 (default) · lg 60 (24/700 value) · xl 64 (onboarding, radius 16)
   */
  size?: AppInputSize;
  /** Typography of the value. Independent of `size`; defaults to body text. */
  valueSize?: AppInputValueSize;
  leadingIcon?: LucideIcon;
  /** Static unit text after the value: kg, cm, steps, L. */
  suffix?: string;
  /** Arbitrary trailing content (e.g. the moon icon on the sleep field). */
  trailing?: React.ReactNode;
  /** Renders a show/hide password button. */
  secureToggle?: boolean;
  helper?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

const FIELD: Record<
  AppInputSize,
  { height: number; radius: number; paddingHorizontal: number }
> = {
  inline: { height: 48, radius: radius.input, paddingHorizontal: 14 },
  md: { height: 56, radius: radius.input, paddingHorizontal: spacing.lg },
  lg: { height: 60, radius: radius.input, paddingHorizontal: spacing.lg },
  xl: { height: 64, radius: radius.card, paddingHorizontal: 18 },
};

/**
 * Value typography is INDEPENDENT of field height: artboard 1b's name field
 * is 64pt tall with 15/500 text, while 1d's weight field is the same height
 * with 24/700. Callers pick the treatment; `MeasurementField` defaults to
 * 'display' because measurements are the numbers worth shouting.
 */
const VALUE_STYLE: Record<AppInputValueSize, object> = {
  body: text.body,
  display: { ...text.title, letterSpacing: -0.3 },
};

export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInputBase(
  {
    label,
    labelBadge,
    labelRight,
    size = 'md',
    valueSize = 'body',
    leadingIcon,
    suffix,
    trailing,
    secureToggle = false,
    helper,
    error,
    containerStyle,
    onFocus,
    onBlur,
    editable = true,
    multiline = false,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  type FocusHandler = NonNullable<TextInputProps['onFocus']>;
  type BlurHandler = NonNullable<TextInputProps['onBlur']>;

  const handleFocus = useCallback<FocusHandler>(
    e => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback<BlurHandler>(
    e => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  const field = FIELD[size];
  const hasError = Boolean(error);
  const isInline = size === 'inline';

  const borderColor = hasError
    ? colors.danger
    : focused && !isInline
    ? colors.userAccent
    : colors.border;

  // Inline fields are filled, not outlined: page tint at rest, green when focused.
  const fieldBackground = !editable
    ? colors.surfaceNeutral
    : isInline
    ? focused
      ? colors.userTint
      : colors.background
    : colors.surface;

  return (
    <View style={containerStyle}>
      {label !== undefined ? (
        <View style={styles.labelRow}>
          <View style={styles.labelGroup}>
            <AppText variant="label" color="textMuted">
              {label}
            </AppText>
            {labelBadge}
          </View>
          {labelRight}
        </View>
      ) : null}

      <View
        style={[
          styles.field,
          hasError ? styles.fieldError : isInline ? styles.fieldFilled : styles.fieldNormal,
          {
            minHeight: multiline ? undefined : field.height,
            borderRadius: field.radius,
            paddingHorizontal: field.paddingHorizontal,
            backgroundColor: fieldBackground,
            borderColor,
          },
          isInline && styles.fieldInline,
          multiline && styles.fieldMultiline,
        ]}
      >
        {leadingIcon ? (
          <AppIcon icon={leadingIcon} size="base" color="textHint" />
        ) : null}

        <TextInput
          ref={ref}
          editable={editable}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureToggle && !revealed}
          placeholderTextColor={colors.textHint}
          selectionColor={colors.userAccent}
          // Android's theme draws a material underline inside the field.
          underlineColorAndroid="transparent"
          maxFontSizeMultiplier={1.3}
          accessibilityLabel={label}
          style={[
            styles.input,
            VALUE_STYLE[valueSize],
            { color: colors.textPrimary },
            isInline && styles.inputInline,
            multiline && styles.inputMultiline,
          ]}
          {...rest}
        />

        {suffix !== undefined ? (
          <AppText variant="body" color="textMuted">
            {suffix}
          </AppText>
        ) : null}

        {trailing}

        {secureToggle ? (
          <AppIconButton
            icon={revealed ? EyeOff : Eye}
            onPress={() => setRevealed(v => !v)}
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            color="textMuted"
            size={40}
            style={styles.secureToggle}
          />
        ) : null}
      </View>

      {hasError ? (
        <AppText
          variant="micro"
          color="danger"
          style={styles.message}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </AppText>
      ) : null}
      {helper !== undefined ? (
        <AppText
          variant="micro"
          color="textHint"
          style={hasError ? styles.messageUnderError : styles.message}
        >
          {helper}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    minHeight: 20,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fieldNormal: { borderWidth: 1 },
  fieldFilled: { borderWidth: 0 },
  fieldError: { borderWidth: 1.5 },
  fieldInline: { gap: spacing.xs + 2, minWidth: 118 },
  inputInline: { textAlign: 'right' },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 14,
    minHeight: 96,
  },
  input: {
    flex: 1,
    // RN adds vendor padding to TextInput on Android; zero it so the
    // 56pt field height is exactly what the design says.
    padding: 0,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    lineHeight: scaleFont(22),
  },
  secureToggle: {
    // Pull the 40pt button into the field's 16pt padding, as the design does.
    marginRight: -10,
  },
  message: {
    marginTop: spacing.sm,
    marginHorizontal: 2,
  },
  /** Tighter, because it sits under the error rather than under the field. */
  messageUnderError: {
    marginTop: spacing.xs,
    marginHorizontal: 2,
  },
});
