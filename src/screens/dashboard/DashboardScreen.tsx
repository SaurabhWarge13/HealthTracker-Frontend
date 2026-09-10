import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Activity,
  ChartNoAxesColumn,
  ClipboardList,
  Clock,
  CloudOff,
  Droplet,
  Moon,
  Plus,
  Target,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react-native';
import {
  AppButton,
  AppDivider,
  AppScreen,
  AppText,
  EmptyState,
  InlineBanner,
  Skeleton,
} from '@/components/common';
import {
  AttainmentRow,
  CheckInRow,
  MetricRingItem,
  StatTile,
  StatusPill,
  TrendChart,
} from '@/components/data';
import {
  ConnectPrompt,
  ProviderSetupPrompt,
  WeightNudgeBanner,
} from '@/components/dashboard';
import { DashboardHeader, SectionCard } from '@/components/layout';
import { hasPlottableTrend } from '@/domain/progress/trend';
import { useHealthConnect } from '@/hooks';
import {
  selectBmi,
  selectCheckInCount,
  selectSleepAndWater,
  selectProgress,
  selectRecentCheckIns,
  selectTrend,
} from '@/store/checkins/checkinsSelectors';
import { runSync } from '@/services/sync';
import { store } from '@/store/store';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { weightNudgeDismissed } from '@/store/healthConnect/healthConnectSlice';
import { selectProfile } from '@/store/profile/profileSelectors';
import { layout, spacing } from '@/theme';
import {
  formatBmi,
  formatDelta,
  formatDurationShort,
  formatDuration,
  formatSteps,
  formatWater,
  formatWeight,
} from '@/utils/formatters';
import type { MainTabScreenProps } from '@/types/navigation';
import { useDashboardState } from './useDashboardState';

export function DashboardScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectProfile);
  const progress = useAppSelector(selectProgress);
  const bmi = useAppSelector(selectBmi);
  const trend = useAppSelector(selectTrend);
  const recent = useAppSelector(selectRecentCheckIns);
  const habits = useAppSelector(selectSleepAndWater);
  const entryCount = useAppSelector(selectCheckInCount);
  const {
    connect,
    openSettings: openHealthConnectSettings,
    openProviderInstall,
  } = useHealthConnect();

  // Resolves the real store state into one view model.
  const view = useDashboardState({ bmi, entryCount });

  const openNewCheckIn = useCallback(
    () => navigation.navigate('CheckInForm'),
    [navigation],
  );
  const openCheckIn = useCallback(
    (id: string) => navigation.navigate('CheckInDetail', { id }),
    [navigation],
  );
  /** The invite goes straight to the field it invites. */
  const openHeightSheet = useCallback(
    () => navigation.navigate('EditProfileField', { field: 'height' }),
    [navigation],
  );
  /** "Set a goal" goes straight to the field it names. */
  const openGoal = useCallback(
    (field: 'sleepGoal' | 'waterGoal') =>
      navigation.navigate('EditProfileField', { field }),
    [navigation],
  );
  const openSettingsTab = useCallback(
    () => navigation.navigate('Tabs', { screen: 'Settings' }),
    [navigation],
  );
  /** Prompts for the permissions we do not have yet, then reads. */
  const requestHealthConnect = useCallback(() => {
    connect();
  }, [connect]);
  /**
   * Manage leaves the app: permissions are granted and revoked in Health
   * Connect itself, and the resume listener picks up whatever changed.
   */
  const manageHealthConnect = useCallback(() => {
    openHealthConnectSettings();
  }, [openHealthConnectSettings]);
  /**
   * The provider itself is unusable. A missing or stale one is resolved in the
   * Play Store; one that is switched off is part of the OS already, so the
   * store has nothing to offer and system settings is the only way back.
   */
  const resolveProviderIssue = useCallback(() => {
    if (view.today.providerIssue === 'disabled') {
      openHealthConnectSettings();
      return;
    }
    openProviderInstall();
  }, [openHealthConnectSettings, openProviderInstall, view.today.providerIssue]);

  const statTiles = useMemo(() => {
    const tiles: React.ReactNode[] = [
      <StatTile
        key="starting"
        label="Starting"
        value={
          progress.startingWeightKg === null
            ? '—'
            : formatWeight(progress.startingWeightKg)
        }
      />,
      <StatTile
        key="target"
        label="Target"
        value={
          profile.targetWeightKg === null ? '—' : formatWeight(profile.targetWeightKg)
        }
      />,
    ];

    // No height is an invitation, not a dead dash.
    tiles.push(
      view.showBmi && bmi !== null ? (
        <StatTile key="bmi" label="BMI" value={formatBmi(bmi)} />
      ) : (
        <StatTile
          key="bmi"
          label="BMI"
          invite={{ label: 'Add height', onPress: openHeightSheet }}
        />
      ),
    );

    tiles.push(<StatTile key="entries" label="Entries" value={String(entryCount)} />);
    return tiles;
  }, [bmi, entryCount, openHeightSheet, profile.targetWeightKg, progress.startingWeightKg, view.showBmi]);

  return (
    <AppScreen
      scroll
      padded="horizontal"
      header={
        <DashboardHeader
          name={profile.name}
          hasNotification={view.pendingCount > 0}
          onPressNotifications={openNewCheckIn}
          onPressSettings={openSettingsTab}
        />
      }
      contentStyle={styles.content}
    >
      {/* Offline is a fact about the network, never framed as data loss. */}
      {view.isOffline ? (
        <InlineBanner
          icon={CloudOff}
          title="You're offline"
          detail="Check-ins are saved here and sync when you're back."
        />
      ) : null}

      {/*
        The refresh failed, so what is on screen is the last good copy rather
        than the current one. Says so without implying anything is lost — the
        check-ins are all still here — and offers the one action that helps.
      */}
      {view.pullFailed ? (
        <InlineBanner
          icon={CloudOff}
          title="Couldn't refresh"
          detail="Showing your saved check-ins."
          trailing={
            <AppButton
              label="Retry"
              variant="text"
              size={32}
              onPress={() => { runSync(store); }}
            />
          }
        />
      ) : null}

      {view.pendingCount > 0 ? (
        <InlineBanner
          icon={Clock}
          title={`${view.pendingCount} ${
            view.pendingCount === 1 ? 'check-in' : 'check-ins'
          } waiting to sync`}
          detail="Saved on device"
          detailPosition="trailing"
        />
      ) : null}

      {/* Gave up on its own; only the user decides what happens next. */}
      {view.failedCount > 0 ? (
        <InlineBanner
          icon={TriangleAlert}
          tone="device"
          title={`${view.failedCount} ${
            view.failedCount === 1 ? 'change' : 'changes'
          } couldn't sync`}
          detail="Saved on this device. Open Settings to review."
          trailing={
            <AppButton
              label="Review"
              variant="text"
              tone="device"
              size={32}
              onPress={openSettingsTab}
            />
          }
        />
      ) : null}

      {/* ── Progress: check-ins and the baseline only ── */}
      <SectionCard
        icon={ChartNoAxesColumn}
        tone="user"
        title="Your progress"
        subtitle="Based on your check-ins"
        footer={
          <AppButton
            label="New check-in"
            size={52}
            fullWidth
            icon={Plus}
            onPress={openNewCheckIn}
          />
        }
      >
        {view.loading ? (
          <ProgressSkeleton />
        ) : view.isEmpty ? (
          <View style={styles.emptyBody}>
            <View style={styles.tiles}>
              <StatTile
                label="Starting"
                value={
                  progress.startingWeightKg === null
                    ? '—'
                    : `${formatWeight(progress.startingWeightKg)} kg`
                }
              />
              <StatTile
                label="Target"
                value={
                  profile.targetWeightKg === null
                    ? '—'
                    : `${formatWeight(profile.targetWeightKg)} kg`
                }
              />
            </View>
            <EmptyState
              icon={TrendingUp}
              ringSize={64}
              iconSize="xl"
              message="Your first check-in starts the line. It takes about ten seconds."
              style={styles.emptyState}
            />
          </View>
        ) : (
          <>
            <AppText variant="label" color="textMuted">
              Current weight
            </AppText>

            <View style={styles.weightRow}>
              <AppText variant="hero" numeric>
                {progress.currentWeightKg === null
                  ? '—'
                  : formatWeight(progress.currentWeightKg)}
              </AppText>
              <AppText variant="body" color="textMuted">
                kg
              </AppText>
              <View style={styles.spacer} />
              <StatusPill
                status={progress.status}
                hasTarget={profile.targetWeightKg !== null}
                trendingDown={(progress.deltaKg ?? 0) <= 0}
              />
            </View>

            {progress.deltaKg !== null ? (
              <AppText
                variant="bodySmallStrong"
                color="statusImproving"
                style={styles.delta}
                numeric
              >
                {progress.deltaKg <= 0 ? '↓' : '↑'} {formatDelta(progress.deltaKg)} kg
                since you started
              </AppText>
            ) : null}

            {view.nudge !== null ? (
              <WeightNudgeBanner
                weightKg={view.nudge.weightKg}
                recordedAt={view.nudge.recordedAt}
                onCheckIn={openNewCheckIn}
                onDismiss={() => dispatch(weightNudgeDismissed())}
              />
            ) : null}

            <View style={styles.tiles}>{statTiles}</View>

            {hasPlottableTrend(trend) ? (
              <View style={styles.chart}>
                <TrendChart trend={trend} />
              </View>
            ) : null}
          </>
        )}
      </SectionCard>

      {/*
        ── Sleep and water: the user's own check-ins, never the device ──

        Habits, not a journey — so this answers "how often did I hit it"
        rather than "how far off am I", which is what the weight trend above
        is for. Hidden until there is something to say.
      */}
      {!view.loading && !view.isEmpty ? (
        <SectionCard
          icon={Target}
          tone="user"
          title="Sleep and water"
          subtitle={`Across your last ${habits.sleep.bars.length} ${
            habits.sleep.bars.length === 1 ? 'check-in' : 'check-ins'
          }`}
        >
          {/*
            Two panels side by side rather than two stacked rows: each habit
            gets its own space instead of sharing a line, and the divider
            between them is no longer needed to tell them apart.
          */}
          <View style={styles.habits}>
            <AttainmentRow
              attainment={habits.sleep}
              icon={Moon}
              label="Sleep"
              // Short form: a round average should read "8h", not "8h 0m".
              format={formatDurationShort}
              onSetGoal={() => openGoal('sleepGoal')}
            />
            <AttainmentRow
              attainment={habits.water}
              icon={Droplet}
              label="Water"
              format={formatWater}
              onSetGoal={() => openGoal('waterGoal')}
            />
          </View>
        </SectionCard>
      ) : null}

      {/* ── Today: Health Connect only. Hidden when the device has no HC. ── */}
      {view.showTodayCard ? (
        <SectionCard
          icon={Activity}
          tone="device"
          title="Today"
          subtitle="From Health Connect"
          footer={
            view.today.showFooter ? (
              <View style={styles.todayFooter}>
                <AppText variant="micro" color="textHint">
                  {view.today.footerLabel}
                </AppText>
                <AppButton
                  label="Manage"
                  variant="text"
                  tone="device"
                  size={48}
                  onPress={manageHealthConnect}
                />
              </View>
            ) : undefined
          }
        >
          {view.today.providerIssue !== null ? (
            /* Health Connect is unusable but fixable — this outranks the
               permission ask, which cannot succeed until it is resolved. */
            <ProviderSetupPrompt
              issue={view.today.providerIssue}
              onAction={resolveProviderIssue}
            />
          ) : view.today.showPrompt ? (
            <ConnectPrompt
              onConnect={requestHealthConnect}
              onDismiss={view.today.onDismissPrompt}
            />
          ) : (
            <View style={styles.rings}>
              <MetricRingItem
                icon={Activity}
                label="Steps"
                state={view.today.steps.state}
                value={
                  view.today.steps.value === null
                    ? undefined
                    : formatSteps(view.today.steps.value)
                }
                goal={
                  profile.stepGoal === null
                    ? undefined
                    : `of ${formatSteps(profile.stepGoal)}`
                }
                progress={view.today.steps.progress}
                onAllow={requestHealthConnect}
              />
              <MetricRingItem
                icon={Moon}
                label="Sleep"
                state={view.today.sleep.state}
                value={
                  view.today.sleep.value === null
                    ? undefined
                    : formatDuration(view.today.sleep.value)
                }
                goal={
                  profile.sleepGoalMinutes === null
                    ? undefined
                    : `of ${formatDurationShort(profile.sleepGoalMinutes)}`
                }
                progress={view.today.sleep.progress}
                onAllow={requestHealthConnect}
              />
              <MetricRingItem
                icon={Droplet}
                label="Water"
                state={view.today.water.state}
                value={
                  view.today.water.value === null
                    ? undefined
                    : formatWater(view.today.water.value)
                }
                goal={
                  profile.waterGoalMl === null
                    ? undefined
                    : `of ${formatWater(profile.waterGoalMl)}`
                }
                progress={view.today.water.progress}
                onAllow={requestHealthConnect}
              />
            </View>
          )}
        </SectionCard>
      ) : null}

      {/* ── Recent check-ins ── */}
      {!view.isEmpty && recent.length > 0 ? (
        <SectionCard
          icon={ClipboardList}
          tone="user"
          title="Recent check-ins"
          subtitle="Your last few entries"
          onPress={() => navigation.navigate('Tabs', { screen: 'History' })}
          bodyPadding={false}
        >
          <View style={styles.recent}>
            {recent.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 ? <AppDivider inset={48} /> : null}
                <CheckInRow
                  checkIn={entry}
                  deltaKg={
                    recent[index + 1]
                      ? entry.weightKg - recent[index + 1].weightKg
                      : null
                  }
                  pendingSync={view.pendingIds.has(entry.id)}
                  failedSync={view.failedIds.has(entry.id)}
                  onPress={() => openCheckIn(entry.id)}
                />
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}
    </AppScreen>
  );
}

/** Artboard 3h: the progress card loads while cached device data stays put. */
function ProgressSkeleton() {
  return (
    <View>
      <Skeleton width={88} height={10} />
      <View style={styles.skeletonRow}>
        <Skeleton width={140} height={34} shape="box" tone="skeletonStrong" />
        <View style={styles.spacer} />
        <Skeleton width={88} height={28} shape="pill" />
      </View>
      <Skeleton width={168} height={10} style={styles.skeletonLine} />
      <View style={styles.tiles}>
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} height={56} shape="box" style={styles.skeletonTile} />
        ))}
      </View>
      <Skeleton height={78} shape="box" style={styles.skeletonChart} />
    </View>
  );
}

const styles = StyleSheet.create({
  /** `stretch` so both panels match the taller one's height. */
  habits: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  content: { paddingBottom: layout.screenPadding, gap: layout.screenPadding },
  weightRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  spacer: { flex: 1 },
  delta: { marginTop: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: layout.cardPadding },
  chart: { marginTop: 18 },
  emptyBody: { gap: 0 },
  emptyState: { paddingTop: 28, paddingHorizontal: spacing.sm },
  rings: { flexDirection: 'row', gap: spacing.sm },
  todayFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recent: { paddingHorizontal: layout.cardPadding, paddingVertical: spacing.sm },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.md,
  },
  skeletonLine: { marginTop: 14 },
  skeletonTile: { flex: 1 },
  skeletonChart: { marginTop: 18 },
});
