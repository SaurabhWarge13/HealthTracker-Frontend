import { useCallback, useMemo, useState } from 'react';
import type { RingState } from '@/components/data';
import { CHECKING_LABEL } from '@/content';
import type { ProviderIssue } from '@/domain/healthConnect/provider';
import {
  selectFieldConnection,
  selectHealthConnect,
  selectHealthConnectProviderIssue,
  selectWeightNudge,
} from '@/store/healthConnect/healthConnectSelectors';
import type { HealthConnectField } from '@/store/healthConnect/healthConnectSlice';
import { useAppSelector } from '@/store/hooks';
import { selectCheckInsUnsettled } from '@/store/checkins/checkinsSelectors';
import {
  selectFailedEntityIds,
  selectPendingCount,
  selectPendingEntityIds,
} from '@/store/sync/syncSelectors';

type Metric = {
  state: RingState;
  value: number | null;
  progress: number;
};

export type DashboardView = {
  loading: boolean;
  isEmpty: boolean;
  showBmi: boolean;
  showTodayCard: boolean;
  pendingCount: number;
  pendingIds: ReadonlySet<string>;
  failedIds: ReadonlySet<string>;
  isOffline: boolean;
  nudge: { weightKg: number; recordedAt: number } | null;
  today: {
    providerIssue: ProviderIssue | null;
    showPrompt: boolean;
    onDismissPrompt: () => void;
    showFooter: boolean;
    footerLabel: string;
    steps: Metric;
    sleep: Metric;
    water: Metric;
  };
};

type Args = {
  bmi: number | null;
  entryCount: number;
};

const ratio = (value: number | null, goal: number | null): number =>
  value === null || goal === null || goal <= 0 ? 0 : value / goal;

const RING_FIELDS: readonly HealthConnectField[] = ['steps', 'sleep', 'water'];

export function useDashboardState({ bmi, entryCount }: Args): DashboardView {
  const hc = useAppSelector(selectHealthConnect);
  const fieldConnection = useAppSelector(selectFieldConnection);
  const providerIssue = useAppSelector(selectHealthConnectProviderIssue);
  const nudge = useAppSelector(selectWeightNudge);
  const loading = useAppSelector(selectCheckInsUnsettled);
  const pendingCount = useAppSelector(selectPendingCount);
  const pendingIds = useAppSelector(selectPendingEntityIds);
  const failedIds = useAppSelector(selectFailedEntityIds);
  const isOffline = useAppSelector(state => !state.connectivity.isOnline);
  const goals = useAppSelector(state => ({
    steps: state.profile.stepGoal,
    water: state.profile.waterGoalMl,
    sleep: state.profile.sleepGoalMinutes,
  }));

  const [promptDismissed, setPromptDismissed] = useState(false);
  const dismissPrompt = useCallback(() => setPromptDismissed(true), []);

  return useMemo<DashboardView>(() => {
    const notSupported = hc.status === 'NOT_SUPPORTED';

    const disconnected = hc.hasChecked && hc.status === 'NOT_CONNECTED';

    const metric = (
      value: number | null,
      goal: number | null,
      denied = false,
    ): Metric => {
      if (denied && hc.hasChecked) {
        return { state: 'notConnected', value: null, progress: 0 };
      }
      if (value === null) {
        return { state: 'noData', value: null, progress: 0 };
      }
      return { state: 'value', value, progress: ratio(value, goal) };
    };

    const steps = metric(
      hc.today.steps,
      goals.steps,
      fieldConnection.steps === 'notConnected',
    );
    const sleep = metric(
      hc.today.sleepMinutes,
      goals.sleep,
      fieldConnection.sleep === 'notConnected',
    );
    const water = metric(
      hc.today.waterMl,
      goals.water,
      fieldConnection.water === 'notConnected',
    );

    const syncedLabel =
      hc.today.syncedAt !== null
        ? `Synced ${new Date(hc.today.syncedAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}`
        : 'Not synced yet';

    const grantedRings = RING_FIELDS.filter(
      field => fieldConnection[field] === 'connected',
    ).length;
    const nothingRecorded =
      grantedRings > 0 &&
      steps.value === null &&
      sleep.value === null &&
      water.value === null;

    const footerLabel = !hc.hasChecked
      ? CHECKING_LABEL
      : grantedRings < RING_FIELDS.length
      ? `${grantedRings} of 3 permissions on`
      : nothingRecorded
      ? `Nothing recorded yet today · ${syncedLabel.toLowerCase()}`
      : syncedLabel;

    return {
      loading,
      isEmpty: entryCount === 0,
      showBmi: bmi !== null,
      showTodayCard: !notSupported,
      pendingCount,
      pendingIds,
      failedIds,
      isOffline,
      nudge,
      today: {
        providerIssue,
        showPrompt: providerIssue === null && disconnected && !promptDismissed,
        onDismissPrompt: dismissPrompt,
        showFooter: providerIssue === null && (!disconnected || promptDismissed),
        footerLabel,
        steps,
        sleep,
        water,
      },
    };
  }, [
    bmi,
    dismissPrompt,
    entryCount,
    failedIds,
    fieldConnection,
    goals.sleep,
    goals.steps,
    goals.water,
    hc,
    isOffline,
    loading,
    nudge,
    pendingCount,
    pendingIds,
    promptDismissed,
    providerIssue,
  ]);
}
