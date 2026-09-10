import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { layout, radius, spacing, type ColorName } from '@/theme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

export type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'neutral'
  | 'deviceFilled'
  | 'deviceTint'
  | 'text';

/** Only meaningful for `variant="text"`. */
export type AppButtonTone = 'user' | 'device' | 'danger' | 'muted';

export type AppButtonSize = 56 | 52 | 48 | 32;

export type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  tone?: AppButtonTone;
  size?: AppButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

type Fill = {
  background: ColorName | null;
  backgroundPressed: ColorName | null;
  foreground: ColorName;
};

const VARIANT: Record<Exclude<AppButtonVariant, 'text'>, Fill> = {
  primary: {
    background: 'userAccent',
    backgroundPressed: 'userAccentPressed',
    foreground: 'textOnAccent',
  },
  secondary: {
    background: 'userTint',
    backgroundPressed: 'userTintPressed',
    foreground: 'userAccent',
  },
  neutral: {
    background: 'surfaceNeutral',
    backgroundPressed: 'surfaceNeutralPressed',
    foreground: 'textMuted',
  },
  deviceFilled: {
    background: 'deviceAccent',
    backgroundPressed: 'deviceAccentPressed',
    foreground: 'textOnAccent',
  },
  deviceTint: {
    background: 'deviceTint',
    backgroundPressed: 'deviceTintPressed',
    foreground: 'deviceAccent',
  },
};

const TEXT_TONE: Record<AppButtonTone, ColorName> = {
  user: 'userAccent',
  device: 'deviceAccent',
  danger: 'danger',
  muted: 'textHint',
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  tone = 'user',
  size = 52,
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
  accessibilityLabel,
  testID,
}: AppButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const isText = variant === 'text';

  /**
   * A text button gets no fill, pressed or not. Its box is only 4pt wider than
   * the label but as tall as the tap target, so a tint reads as a slab clamped
   * around the words rather than a highlight — wrong for something that sits
   * inline in a sentence. The label dims instead (`styles.textPressed`).
   */
  const fill: Fill = isText
    ? { background: null, backgroundPressed: null, foreground: TEXT_TONE[tone] }
    : VARIANT[variant];

  const foreground: ColorName = disabled && !isText ? 'textOnAccent' : fill.foreground;

  const backgroundFor = (pressed: boolean): string | undefined => {
    if (disabled && !isText) {
      return colors.disabledFill;
    }
    if (pressed && fill.backgroundPressed !== null) {
      return colors[fill.backgroundPressed];
    }
    return fill.background !== null ? colors[fill.background] : undefined;
  };

  // Small (32) buttons use the 12/600 chip-ish label; everything else 15/600.
  const labelVariant = size === 32 ? 'captionStrong' : 'bodyStrong';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      // Short buttons still need a 48pt touch target.
      hitSlop={Math.max(0, (layout.minTapTarget - size) / 2)}
      /**
       * No `android_ripple` on purpose. RN masks a bounded ripple with a plain
       * rectangle (ReactDrawableHelper.getMask), so on a pill it paints square
       * corners for the length of the press. The feedback is the pressed fill
       * below (or a dimmed label for `text`), and it matches iOS.
       */
      style={({ pressed }) => [
        styles.base,
        {
          height: size,
          borderRadius: size / 2,
          paddingHorizontal: isText ? spacing.xs : spacing.xl,
          backgroundColor: backgroundFor(pressed && !inactive),
        },
        fullWidth ? styles.fullWidth : styles.hugContent,
        pressed && !inactive && isText && styles.textPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[foreground]} />
      ) : (
        <>
          {icon ? <AppIcon icon={icon} size="base" color={foreground} /> : null}
          <AppText variant={labelVariant} color={foreground}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
    borderRadius: radius.pill,
  },
  /** The whole press state for `text`: no shape appears, the label fades. */
  textPressed: { opacity: 0.6 },
  fullWidth: { alignSelf: 'stretch' },
  hugContent: { alignSelf: 'flex-start' },
});
