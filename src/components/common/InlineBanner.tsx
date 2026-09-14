import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, type ColorName } from '@/theme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

export type InlineBannerTone = 'neutral' | 'device';

export type InlineBannerProps = {
  icon: LucideIcon;
  title: string;
  detail?: string;
  detailPosition?: 'below' | 'trailing';
  trailing?: React.ReactNode;
  tone?: InlineBannerTone;
  style?: StyleProp<ViewStyle>;
};

const TONE: Record<InlineBannerTone, { background: ColorName; icon: ColorName; title: ColorName }> = {
  neutral: { background: 'surfaceNeutral', icon: 'textMuted', title: 'textMuted' },
  device: { background: 'deviceTint', icon: 'deviceAccent', title: 'deviceAccent' },
};

export function InlineBanner({
  icon,
  title,
  detail,
  detailPosition = 'below',
  trailing,
  tone = 'neutral',
  style,
}: InlineBannerProps) {
  const { colors } = useTheme();
  const palette = TONE[tone];

  return (
    <View
      style={[styles.row, { backgroundColor: colors[palette.background] }, style]}
      accessibilityLiveRegion="polite"
    >
      <AppIcon icon={icon} size="base" color={palette.icon} />

      <View style={styles.text}>
        <AppText variant="bodySmall" color={palette.title}>
          {title}
        </AppText>
        {detail !== undefined && detailPosition === 'below' ? (
          <AppText variant="micro" color="textMuted">
            {detail}
          </AppText>
        ) : null}
      </View>

      {detail !== undefined && detailPosition === 'trailing' ? (
        <AppText variant="micro" color="textHint">
          {detail}
        </AppText>
      ) : null}

      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderRadius: radius.input,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
  },
  text: { flex: 1, gap: 2 },
});
