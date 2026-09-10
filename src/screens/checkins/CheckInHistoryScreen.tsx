import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ClipboardList, Droplet, Moon, Target } from 'lucide-react-native';
import {
  AppButton,
  AppDivider,
  AppIcon,
  AppScreen,
  AppText,
  EmptyState,
  InlineBanner,
  Skeleton,
} from '@/components/common';
import { CheckInRow } from '@/components/data';
import type { CheckIn } from '@/domain/checkins/types';
import {
  selectCheckInCount,
  selectCheckInsUnsettled,
  selectCheckInsWithDelta,
} from '@/store/checkins/checkinsSelectors';
import { selectProfile } from '@/store/profile/profileSelectors';
import { useAppSelector } from '@/store/hooks';
import {
  selectFailedEntityIds,
  selectPendingEntityIds,
} from '@/store/sync/syncSelectors';
import { useTheme } from '@/hooks/useTheme';
import { layout, radius, spacing } from '@/theme';
import {
  dayKey,
  formatDayTitle,
  formatMonthTitle,
  monthKey,
} from '@/utils/formatters';
import type { EditableProfileField, MainTabScreenProps } from '@/types/navigation';

type DeltaRow = { checkIn: CheckIn; deltaKg: number | null };

type DayGroup = {
  /** `dayKey` — also the FlatList key. */
  key: string;
  /** The day's newest timestamp, formatted at render. */
  at: number;
  rows: DeltaRow[];
  /**
   * Set only on the first group of a month *after* the first, so a separator
   * marks the change. The topmost group is left null: its day label already
   * names the month, so a heading above it would only repeat itself.
   */
  monthLabel: string | null;
};

/**
 * `rows` arrives newest-first from `selectCheckInsWithDelta`, and both `Map`
 * and the output array preserve insertion order — so days come out
 * newest-first and rows within a day newest-first, with no sort.
 *
 * Note the deltas are already computed against the previous check-in
 * *overall*, so the first row of a day correctly compares against the last
 * row of the day before. Re-deriving them per group would silently break that.
 */
function groupByDay(rows: readonly DeltaRow[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();
  let lastMonth = rows.length > 0 ? monthKey(rows[0].checkIn.createdAt) : null;

  for (const row of rows) {
    const key = dayKey(row.checkIn.createdAt);
    let group = byKey.get(key);

    if (group === undefined) {
      const month = monthKey(row.checkIn.createdAt);
      group = {
        key,
        at: row.checkIn.createdAt,
        rows: [],
        monthLabel:
          month === lastMonth ? null : formatMonthTitle(row.checkIn.createdAt),
      };
      lastMonth = month;
      byKey.set(key, group);
      groups.push(group);
    }

    group.rows.push(row);
  }

  return groups;
}

export function CheckInHistoryScreen({
  navigation,
}: MainTabScreenProps<'History'>) {
  const rows = useAppSelector(selectCheckInsWithDelta);
  const total = useAppSelector(selectCheckInCount);
  const loading = useAppSelector(selectCheckInsUnsettled);
  const pendingIds = useAppSelector(selectPendingEntityIds);
  const failedIds = useAppSelector(selectFailedEntityIds);
  const { sleepGoalMinutes, waterGoalMl } = useAppSelector(selectProfile);

  const days = useMemo(() => groupByDay(rows), [rows]);

  const openCheckIn = useCallback(
    (id: string) => navigation.navigate('CheckInDetail', { id }),
    [navigation],
  );

  const openGoal = useCallback(
    (field: EditableProfileField) =>
      navigation.navigate('EditProfileField', { field }),
    [navigation],
  );

  const renderDay = useCallback(
    ({ item }: { item: DayGroup }) => (
      <View style={styles.dayGroup}>
        {item.monthLabel !== null ? <MonthRule label={item.monthLabel} /> : null}

        <AppText variant="overline" color="textHint" style={styles.dayLabel}>
          {formatDayTitle(item.at)}
        </AppText>

        <DaySheet>
          {item.rows.map((row, index) => (
            <View key={row.checkIn.id}>
              {index > 0 ? <AppDivider inset={48} /> : null}
              <CheckInRow
                variant="metrics"
                checkIn={row.checkIn}
                deltaKg={row.deltaKg}
                sleepGoalMinutes={sleepGoalMinutes}
                waterGoalMl={waterGoalMl}
                pendingSync={pendingIds.has(row.checkIn.id)}
                failedSync={failedIds.has(row.checkIn.id)}
                onPress={() => openCheckIn(row.checkIn.id)}
              />
            </View>
          ))}
        </DaySheet>
      </View>
    ),
    [failedIds, openCheckIn, pendingIds, sleepGoalMinutes, waterGoalMl],
  );

  if (loading) {
    // `padded`, not `'horizontal'`: with no header the top gap has to come
    // from the screen itself.
    return (
      <AppScreen scroll padded contentStyle={styles.content}>
        <HistorySkeleton rows={2} />
        <HistorySkeleton />
        <HistorySkeleton />
      </AppScreen>
    );
  }

  if (total === 0) {
    return (
      <AppScreen padded>
        <EmptyCard>
          <EmptyState
            icon={ClipboardList}
            title="No check-ins yet"
            message="Every check-in you save shows up here, newest first."
            actionLabel="New check-in"
            onAction={() => navigation.navigate('CheckInForm')}
          />
        </EmptyCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen padded="horizontal">
      <FlatList
        data={days}
        keyExtractor={group => group.key}
        renderItem={renderDay}
        ListHeaderComponent={
          <ListIntro
            sleepGoalMinutes={sleepGoalMinutes}
            waterGoalMl={waterGoalMl}
            onSetGoal={openGoal}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        /**
         * A day group is ~90dp against a ~780dp viewport, so ten items is
         * about one screenful — accurate now that items are days, not months.
         */
        initialNumToRender={10}
      />
    </AppScreen>
  );
}

/**
 * The legend, plus an invitation when a goal is missing.
 *
 * Naming the two glyphs once here is what lets every row drop its labels. The
 * goal prompt lives up here rather than in the rows for the same reason it is
 * phrased as an invitation: without a goal no row has a verdict to show, so
 * none of them should imply one.
 */
function ListIntro({
  sleepGoalMinutes,
  waterGoalMl,
  onSetGoal,
}: {
  sleepGoalMinutes: number | null;
  waterGoalMl: number | null;
  onSetGoal: (field: EditableProfileField) => void;
}) {
  const { colors } = useTheme();
  const noSleep = sleepGoalMinutes === null;
  const noWater = waterGoalMl === null;

  return (
    <View style={styles.intro}>
      <View style={styles.legend} accessibilityLabel="Each row shows sleep and water as a bar; a full bar means the goal was met">
        <View style={styles.legendItem}>
          <AppIcon icon={Moon} size="sm" color="userAccent" />
          <AppText variant="micro" color="textHint">
            Sleep
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <AppIcon icon={Droplet} size="sm" color="userAccent" />
          <AppText variant="micro" color="textHint">
            Water
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBar, { backgroundColor: colors.userAccent }]} />
          <AppText variant="micro" color="textHint">
            goal met
          </AppText>
        </View>
      </View>

      {noSleep || noWater ? (
        <InlineBanner
          icon={Target}
          title={
            noSleep && noWater
              ? 'No sleep or water goal'
              : noSleep
              ? 'No sleep goal'
              : 'No water goal'
          }
          detail="Bars show what you logged, ungraded."
          trailing={
            <AppButton
              label="Set"
              variant="text"
              tone="user"
              size={48}
              onPress={() => onSetGoal(noSleep ? 'sleepGoal' : 'waterGoal')}
            />
          }
        />
      ) : null}
    </View>
  );
}

/** A day's rows, on one rounded surface. No header — the date sits above it. */
function DaySheet({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.daySheet, { backgroundColor: colors.surface }]}>
      {children}
    </View>
  );
}

/** Keeps month context once day grouping has taken it out of the headings. */
function MonthRule({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.monthRule}>
      <View style={[styles.monthLine, { backgroundColor: colors.border }]} />
      <AppText variant="overline" color="textHint">
        {label}
      </AppText>
      <View style={[styles.monthLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

/** Artboard 5b centres the empty state on its own card. */
function EmptyCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
        {children}
      </View>
    </View>
  );
}

/** Mirrors the real shape: a short day label above a sheet of rows. */
function HistorySkeleton({ rows = 1 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dayGroup}>
      <Skeleton width={72} height={9} />
      <View style={[styles.daySheet, { backgroundColor: colors.surface }]}>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width={40} height={40} shape="circle" />
            <View style={styles.skeletonText}>
              <Skeleton width={84} height={14} tone="skeletonStrong" />
              <Skeleton width={48} height={9} />
            </View>
            <View style={styles.skeletonMeters}>
              <Skeleton width={62} height={5} shape="pill" />
              <Skeleton width={62} height={5} shape="pill" />
            </View>
            <Skeleton width={52} height={24} shape="pill" />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Only the gap: AppScreen's own insets set the padding on a scroll screen.
  content: { gap: layout.screenPadding },
  listContent: {
    // The list is the top of the screen now that the header is gone.
    paddingTop: layout.screenPadding,
    paddingBottom: layout.screenPadding,
    gap: layout.screenPadding,
  },

  intro: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendBar: { width: 18, height: 5, borderRadius: radius.pill },

  dayGroup: { gap: spacing.xs },
  dayLabel: { paddingLeft: 2 },
  daySheet: {
    borderRadius: radius.card,
    overflow: 'hidden',
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.xs,
  },

  monthRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  monthLine: { flex: 1, height: StyleSheet.hairlineWidth },

  emptyWrap: { flex: 1, justifyContent: 'center' },
  emptyCard: {
    borderRadius: radius.card,
    paddingVertical: 36,
    paddingHorizontal: spacing.xl,
  },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  skeletonText: { flex: 1, gap: 6 },
  skeletonMeters: { gap: 6 },
});
