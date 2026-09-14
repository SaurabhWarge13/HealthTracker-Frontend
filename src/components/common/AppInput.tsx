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

export type AppInputValueSize = 'body' | 'display';

export type AppInputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  labelBadge?: React.ReactNode;
  labelRight?: React.ReactNode;
  size?: AppInputSize;
  valueSize?: AppInputValueSize;
  leadingIcon?: LucideIcon;
  suffix?: string;
  trailing?: React.ReactNode;
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
    padding: 0,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    lineHeight: scaleFont(22),
  },
  secureToggle: {
    marginRight: -10,
  },
  message: {
    marginTop: spacing.sm,
    marginHorizontal: 2,
  },
  messageUnderError: {
    marginTop: spacing.xs,
    marginHorizontal: 2,
  },
});
