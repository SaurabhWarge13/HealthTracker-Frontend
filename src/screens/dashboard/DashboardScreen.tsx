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
import {
  ACTION_LABEL,
  EMPTY_VALUE,
  FIELD_LABEL,
  NEW_CHECKIN,
  UNIT,
} from '@/content';
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

  const view = useDashboardState({ bmi, entryCount });

  const openNewCheckIn = useCallback(
    () => navigation.navigate('CheckInForm'),
    [navigation],
  );
  const openCheckIn = useCallback(
    (id: string) => navigation.navigate('CheckInDetail', { id }),
    [navigation],
  );
  const openHeightSheet = useCallback(
    () => navigation.navigate('EditProfileField', { field: 'height' }),
    [navigation],
  );
  const openGoal = useCallback(
    (field: 'sleepGoal' | 'waterGoal') =>
      navigation.navigate('EditProfileField', { field }),
    [navigation],
  );
  const openSettingsTab = useCallback(
    () => navigation.navigate('Tabs', { screen: 'Settings' }),
    [navigation],
  );
  const requestHealthConnect = useCallback(() => {
    connect();
  }, [connect]);
  const manageHealthConnect = useCallback(() => {
    openHealthConnectSettings();
  }, [openHealthConnectSettings]);
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
            ? EMPTY_VALUE
            : formatWeight(progress.startingWeightKg)
        }
      />,
      <StatTile
        key="target"
        label="Target"
        value={
          profile.targetWeightKg === null ? EMPTY_VALUE : formatWeight(profile.targetWeightKg)
        }
      />,
    ];

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
      {view.isOffline ? (
        <InlineBanner
          icon={CloudOff}
          title="You're offline"
          detail="Check-ins are saved here and sync when you're back."
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

      <SectionCard
        icon={ChartNoAxesColumn}
        tone="user"
        title="Your progress"
        subtitle="Based on your check-ins"
        footer={
          <AppButton
            label={NEW_CHECKIN}
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
                    ? EMPTY_VALUE
                    : `${formatWeight(progress.startingWeightKg)} ${UNIT.kg}`
                }
              />
              <StatTile
                label="Target"
                value={
                  profile.targetWeightKg === null
                    ? EMPTY_VALUE
                    : `${formatWeight(profile.targetWeightKg)} ${UNIT.kg}`
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
                  ? EMPTY_VALUE
                  : formatWeight(progress.currentWeightKg)}
              </AppText>
              <AppText variant="body" color="textMuted">
                {UNIT.kg}
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

      {!view.loading && !view.isEmpty ? (
        <SectionCard
          icon={Target}
          tone="user"
          title="Sleep and water"
          subtitle={`Across your last ${habits.sleep.bars.length} ${
            habits.sleep.bars.length === 1 ? 'check-in' : 'check-ins'
          }`}
        >
          <View style={styles.habits}>
            <AttainmentRow
              attainment={habits.sleep}
              icon={Moon}
              label={FIELD_LABEL.sleep}
              format={formatDurationShort}
              onSetGoal={() => openGoal('sleepGoal')}
            />
            <AttainmentRow
              attainment={habits.water}
              icon={Droplet}
              label={FIELD_LABEL.water}
              format={formatWater}
              onSetGoal={() => openGoal('waterGoal')}
            />
          </View>
        </SectionCard>
      ) : null}

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
                  label={ACTION_LABEL.manage}
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
                label={FIELD_LABEL.steps}
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
                label={FIELD_LABEL.sleep}
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
                label={FIELD_LABEL.water}
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
