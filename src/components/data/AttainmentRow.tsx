import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppIcon, AppText } from '@/components/common';
import { EMPTY_VALUE } from '@/content';
import type { Attainment, AttainmentStatus } from '@/domain/progress/attainment';
import { useTheme } from '@/hooks/useTheme';
import { radius, scaleFont, spacing, type ColorName } from '@/theme';

export type AttainmentRowProps = {
  attainment: Attainment;
  icon: LucideIcon;
  label: string;
  format: (value: number) => string;
  onSetGoal?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const STATUS: Record<AttainmentStatus, { label: string; dot: ColorName }> = {
  onTrack: { label: 'On track', dot: 'statusImproving' },
  mixed: { label: 'Mixed', dot: 'statusSteady' },
  offTarget: { label: 'Off target', dot: 'textHint' },
  noGoal: { label: 'No goal', dot: 'textHint' },
  notRecorded: { label: 'Nothing logged', dot: 'textHint' },
  notEnoughData: { label: 'Just started', dot: 'textHint' },
};

const DOT = 8;
const DOT_GAP = 2;
const GAP_POINT = 3;

const HERO_SIZE = 32;

export function AttainmentRow({
  attainment,
  icon,
  label,
  format,
  onSetGoal,
  style,
  testID,
}: AttainmentRowProps) {
  const { colors } = useTheme();
  const { status, recorded, hits, average, bars } = attainment;
  const presentation = STATUS[status];

  const graded =
    status === 'onTrack' || status === 'mixed' || status === 'offTarget';

  const averageText = average === null ? EMPTY_VALUE : format(average);

  const heroValue = graded ? `${hits}` : status === 'notRecorded' ? EMPTY_VALUE : averageText;
  const heroSuffix = graded ? `/${recorded}` : null;

  const footText = graded
    ? `${presentation.label} · ${averageText}`
    : status === 'notEnoughData'
    ? `${presentation.label} · ${recorded} logged`
    : presentation.label;

  const spokenState =
    status === 'noGoal'
      ? 'no goal set'
      : graded
      ? `${presentation.label}, ${hits} of ${recorded} check-ins, average ${averageText}`
      : status === 'notEnoughData'
      ? `${presentation.label}, ${recorded} logged, average ${averageText}`
      : presentation.label;

  return (
    <View
      style={[styles.panel, { backgroundColor: colors.surfaceTint }, style]}
      accessible
      accessibilityLabel={`${label}: ${spokenState}`}
    >
      <View style={styles.header}>
        <AppIcon icon={icon} size="base" color="userAccent" />
        <AppText variant="rowTitle" style={styles.label} numberOfLines={1}>
          {label}
        </AppText>
        <View
          style={[styles.dot, { backgroundColor: colors[presentation.dot] }]}
        />
      </View>

      <View style={styles.hero}>
        {graded ? (
          <>
            <AppText
              variant="hero"
              numeric
              style={styles.heroGraded}
              numberOfLines={1}
            >
              {heroValue}
            </AppText>
            <AppText variant="body" color="textMuted" numeric>
              {heroSuffix}
            </AppText>
          </>
        ) : (
          <AppText variant="title" numeric numberOfLines={1}>
            {heroValue}
          </AppText>
        )}
      </View>

      {bars.length > 0 ? (
        <View style={styles.strip}>
          {bars.map(bar =>
            bar.ratio === null ? (
              <View key={bar.at} style={styles.slot}>
                <View
                  testID={testID === undefined ? undefined : `${testID}-gap`}
                  style={[
                    styles.point,
                    { backgroundColor: colors.userChartSoft },
                  ]}
                />
              </View>
            ) : (
              <View
                key={bar.at}
                testID={testID === undefined ? undefined : `${testID}-bar`}
                style={[
                  styles.mark,
                  bar.hit
                    ? { backgroundColor: colors.userAccent }
                    : [styles.ring, { borderColor: colors.userChart }],
                ]}
              />
            ),
          )}
        </View>
      ) : null}

      {status === 'noGoal' && onSetGoal !== undefined ? (
        <Pressable
          onPress={onSetGoal}
          accessibilityRole="button"
          accessibilityLabel={`Set a ${label.toLowerCase()} goal`}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: pressed
                ? colors.userTintPressed
                : colors.userTint,
            },
          ]}
        >
          <AppText variant="bodySmall" color="userAccent">
            Set a goal
          </AppText>
        </Pressable>
      ) : (
        <AppText variant="label" color="textMuted" numeric numberOfLines={1}>
          {footText}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.inner,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: radius.pill, flexShrink: 0 },

  hero: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  heroGraded: {
    fontSize: scaleFont(HERO_SIZE),
    lineHeight: scaleFont(HERO_SIZE),
    letterSpacing: -0.8,
  },

  strip: { flexDirection: 'row', alignItems: 'center', gap: DOT_GAP, height: DOT },
  mark: {
    width: DOT,
    height: DOT,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  ring: { borderWidth: 1.5 },
  slot: {
    width: DOT,
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  point: { width: GAP_POINT, height: GAP_POINT, borderRadius: radius.pill },

  cta: {
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
