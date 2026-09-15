import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Clock, Droplet, Moon, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { AppIcon, AppText } from '@/components/common';
import { FIELD_LABEL, UNIT } from '@/content';
import { moodIcon } from '@/components/checkins/MoodIcon';
import { MOOD_LABELS, type CheckIn } from '@/domain/checkins/types';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, type ColorName } from '@/theme';
import {
  formatDelta,
  formatDuration,
  formatRowDate,
  formatTime,
  formatWater,
  formatWeight,
  formatWeightWithUnit,
} from '@/utils/formatters';
import { DeltaBadge } from './DeltaBadge';

export type CheckInRowVariant = 'date' | 'metrics';

export type CheckInRowProps = {
  checkIn: CheckIn;
  deltaKg: number | null;
  onPress?: () => void;
  pendingSync?: boolean;
  failedSync?: boolean;
  now?: number;
  variant?: CheckInRowVariant;
  sleepGoalMinutes?: number | null;
  waterGoalMl?: number | null;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 5;
const MIN_FILL = 5;
const UNGRADED_FILL = 20;

type Meter =
  | { kind: 'hit'; fill: number }
  | { kind: 'under'; fill: number }
  | { kind: 'ungraded'; fill: number }
  | { kind: 'blank' };

function meterFor(value: number | null, goal: number | null | undefined): Meter {
  if (value === null) {
    return { kind: 'blank' };
  }
  if (goal === null || goal === undefined || goal <= 0) {
    return { kind: 'ungraded', fill: UNGRADED_FILL };
  }
  if (value >= goal) {
    return { kind: 'hit', fill: TRACK_WIDTH };
  }
  return {
    kind: 'under',
    fill: Math.max(MIN_FILL, (value / goal) * TRACK_WIDTH),
  };
}

const METER_ICON: Record<Meter['kind'], ColorName> = {
  hit: 'userAccent',
  under: 'userAccent',
  ungraded: 'textMuted',
  blank: 'textHint',
};

function MetricMeter({
  icon,
  value,
  goal,
  testID,
}: {
  icon: LucideIcon;
  value: number | null;
  goal: number | null | undefined;
  testID?: string;
}) {
  const { colors } = useTheme();
  const meter = meterFor(value, goal);

  return (
    <View style={styles.meterRow}>
      <AppIcon icon={icon} size="sm" color={METER_ICON[meter.kind]} />

      {meter.kind === 'blank' ? (
        <View style={styles.meterBed} testID={testID}>
          <View
            style={[styles.blankDot, { backgroundColor: colors.userChartSoft }]}
          />
        </View>
      ) : meter.kind === 'ungraded' ? (
        <View style={styles.meterBed} testID={testID}>
          <View
            style={[
              styles.fill,
              { width: meter.fill, backgroundColor: colors.userChart },
            ]}
          />
        </View>
      ) : (
        <View
          style={[styles.track, { backgroundColor: colors.surfaceNeutral }]}
          testID={testID}
        >
          <View
            style={[
              styles.fill,
              {
                width: meter.fill,
                backgroundColor:
                  meter.kind === 'hit' ? colors.userAccent : colors.userChart,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const STEADY_BAND_KG = 0.05;

const deltaPhrase = (deltaKg: number | null): string => {
  if (deltaKg === null) {
    return 'no previous check-in';
  }
  if (Math.abs(deltaKg) < STEADY_BAND_KG) {
    return 'no change';
  }
  return `${deltaKg < 0 ? 'down' : 'up'} ${formatDelta(deltaKg)} kilograms`;
};

const metricPhrase = (
  label: string,
  value: number | null,
  goal: number | null | undefined,
  format: (value: number) => string,
): string => {
  if (value === null) {
    return `${label} not logged`;
  }
  if (goal === null || goal === undefined || goal <= 0) {
    return `${label} ${format(value)}`;
  }
  return `${label} ${format(value)}, goal ${value >= goal ? 'met' : 'missed'}`;
};

export function CheckInRow({
  checkIn,
  deltaKg,
  onPress,
  pendingSync = false,
  failedSync = false,
  now = Date.now(),
  variant = 'date',
  sleepGoalMinutes,
  waterGoalMl,
  testID,
  style,
}: CheckInRowProps) {
  const { colors } = useTheme();

  const date = formatRowDate(checkIn.createdAt, now);
  const syncNote = failedSync
    ? ' · not synced'
    : pendingSync
    ? ' · waiting to sync'
    : '';

  const syncIcon = failedSync ? (
    <AppIcon icon={TriangleAlert} size="sm" color="deviceAccent" />
  ) : pendingSync ? (
    <AppIcon icon={Clock} size="sm" color="textHint" />
  ) : null;

  if (variant === 'date') {
    const meta = `${formatTime(checkIn.createdAt)} · ${formatWeightWithUnit(
      checkIn.weightKg,
    )}${syncNote}`;

    const content = (
      <>
        <View style={[styles.moodCircle, { backgroundColor: colors.userTint }]}>
          <AppIcon icon={moodIcon(checkIn.mood)} size="base" color="userAccent" />
        </View>

        <View style={styles.text}>
          <View style={styles.dateRow}>
            <AppText variant="rowTitle" numberOfLines={1}>
              {date}
            </AppText>
            {syncIcon}
          </View>
          <AppText variant="micro" color="textHint" numeric numberOfLines={1}>
            {meta}
          </AppText>
        </View>

        <DeltaBadge deltaKg={deltaKg} />
      </>
    );

    if (onPress === undefined) {
      return <View style={[styles.row, style]}>{content}</View>;
    }

    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${date}, ${meta}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
      >
        {content}
      </Pressable>
    );
  }

  const spoken = [
    `${date}, ${formatTime(checkIn.createdAt)}`,
    `${formatWeightWithUnit(checkIn.weightKg)}, ${deltaPhrase(deltaKg)}`,
    metricPhrase(FIELD_LABEL.sleep, checkIn.sleepMinutes, sleepGoalMinutes, formatDuration),
    metricPhrase(FIELD_LABEL.water, checkIn.waterMl, waterGoalMl, formatWater),
    checkIn.mood === null ? 'Mood not recorded' : MOOD_LABELS[checkIn.mood],
    failedSync ? 'Not synced' : pendingSync ? 'Waiting to sync' : '',
  ]
    .filter(part => part !== '')
    .join('. ');

  const content = (
    <>
      {checkIn.mood === null ? (
        <View
          style={[styles.moodLarge, { backgroundColor: colors.surfaceNeutral }]}
        >
          <AppIcon icon={moodIcon(null)} size="lg" color="textHint" />
        </View>
      ) : (
        <View style={[styles.moodLarge, { backgroundColor: colors.userTint }]}>
          <AppIcon icon={moodIcon(checkIn.mood)} size="lg" color="userAccent" />
        </View>
      )}

      <View style={styles.weightBlock}>
        <View style={styles.weightRow}>
          <AppText variant="title" numeric numberOfLines={1}>
            {formatWeight(checkIn.weightKg)}
          </AppText>
          <AppText variant="bodySmall" color="textMuted">
            {UNIT.kg}
          </AppText>
        </View>
        <View style={styles.timeRow}>
          <AppText variant="micro" color="textHint" numeric numberOfLines={1}>
            {formatTime(checkIn.createdAt)}
          </AppText>
          {syncIcon}
        </View>
      </View>

      <View style={styles.meters}>
        <MetricMeter
          icon={Moon}
          value={checkIn.sleepMinutes}
          goal={sleepGoalMinutes}
          testID={testID === undefined ? undefined : `${testID}-sleep`}
        />
        <MetricMeter
          icon={Droplet}
          value={checkIn.waterMl}
          goal={waterGoalMl}
          testID={testID === undefined ? undefined : `${testID}-water`}
        />
      </View>

      <DeltaBadge deltaKg={deltaKg} />
    </>
  );

  if (onPress === undefined) {
    return <View style={[styles.rowMetrics, style]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={({ pressed }) => [
        styles.rowMetrics,
        pressed && styles.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  moodCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  pressed: { opacity: 0.6 },

  rowMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  moodLarge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  weightBlock: { flex: 1, minWidth: 0, gap: 2 },
  weightRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  meters: { gap: 6, flexShrink: 0 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  meterBed: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    justifyContent: 'center',
  },
  fill: { height: TRACK_HEIGHT, borderRadius: radius.pill },
  blankDot: { width: 3, height: 3, borderRadius: radius.pill },
});
