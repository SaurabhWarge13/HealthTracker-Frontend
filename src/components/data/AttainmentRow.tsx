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
import type { Attainment, AttainmentStatus } from '@/domain/progress/attainment';
import { useTheme } from '@/hooks/useTheme';
import { radius, scaleFont, spacing, type ColorName } from '@/theme';

export type AttainmentRowProps = {
  attainment: Attainment;
  icon: LucideIcon;
  label: string;
  /** Turns a stored value into something readable — minutes, millilitres. */
  format: (value: number) => string;
  /** Offered when there is no goal to measure against. */
  onSetGoal?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Recorded marks carry it; a gap gets `-gap` so the two are never confused. */
  testID?: string;
};

/**
 * Every state names itself. The dot repeats the state in colour, so colour is
 * never the only carrier — and off-target is grey, not terracotta, because
 * the whole app renders off-track in grey and this card must not shout louder
 * than the weight card above it.
 */
const STATUS: Record<AttainmentStatus, { label: string; dot: ColorName }> = {
  onTrack: { label: 'On track', dot: 'statusImproving' },
  mixed: { label: 'Mixed', dot: 'statusSteady' },
  offTarget: { label: 'Off target', dot: 'textHint' },
  noGoal: { label: 'No goal', dot: 'textHint' },
  notRecorded: { label: 'Nothing logged', dot: 'textHint' },
  notEnoughData: { label: 'Just started', dot: 'textHint' },
};

/**
 * 8dp marks with 2dp between them — ten of them need 98dp.
 *
 * That number is load-bearing. Panel content is `(deviceWidth - 68) / 2` less
 * this panel's padding, which is 102dp on a 320dp phone and 122dp on a common
 * 360dp one. The 9dp/4dp spacing the design was drawn at needs 126dp and
 * clips on everything narrower than 390. This fits every phone with no
 * measuring pass and looks near-identical.
 */
const DOT = 8;
const DOT_GAP = 2;
const GAP_POINT = 3;

/** The graded figure is bigger than the type scale goes; the face stays `hero`. */
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

  const averageText = average === null ? '—' : format(average);

  /**
   * A rate only when one is meaningful. Below three recorded values the
   * average is the honest headline instead — "2 of 2" off two nights reads as
   * a perfect record.
   */
  const heroValue = graded ? `${hits}` : status === 'notRecorded' ? '—' : averageText;
  const heroSuffix = graded ? `/${recorded}` : null;

  /**
   * The state in a word, plus the number the metric is actually about.
   *
   * Direction A as drawn showed the word alone, which meant a graded panel
   * never said how much the user slept — the one figure sleep is about. The
   * word comes first so it still reads as the state.
   */
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
              // A point, not an empty slot: near-zero ink is what makes
              // "never logged" unmistakable next to a recorded zero.
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
    // 12, not 16: two panels plus ten marks do not fit a 320dp phone at 16.
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
  /** Logged but under the goal — outlined, deliberately unfilled. */
  ring: { borderWidth: 1.5 },
  slot: {
    width: DOT,
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  point: { width: GAP_POINT, height: GAP_POINT, borderRadius: radius.pill },

  /** Reaches the 48dp minimum the bare text link never did. */
  cta: {
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
