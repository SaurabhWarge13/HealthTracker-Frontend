import { useCallback, useMemo, useState } from 'react';
import type { RingState } from '@/components/data';
import type { ProviderIssue } from '@/domain/healthConnect/provider';
import {
  selectHealthConnect,
  selectHealthConnectProviderIssue,
  selectWeightNudge,
} from '@/store/healthConnect/healthConnectSelectors';
import { useAppSelector } from '@/store/hooks';
import { selectCheckInsUnsettled } from '@/store/checkins/checkinsSelectors';
import {
  selectFailedCount,
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
  /** Check-ins saved here but not yet on the server. */
  pendingCount: number;
  /** Which rows get the waiting-to-sync clock. */
  pendingIds: ReadonlySet<string>;
  /** Ops that gave up and need the user to decide. */
  failedCount: number;
  /** Which rows get the warning marker. */
  failedIds: ReadonlySet<string>;
  isOffline: boolean;
  /** The last refresh did not come back. Local data is still shown. */
  pullFailed: boolean;
  nudge: { weightKg: number; recordedAt: number } | null;
  today: {
    /**
     * The provider itself needs installing, enabling or updating — which
     * outranks everything else in the card, because no permission can be
     * granted and no ring can have data until it is resolved.
     */
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

export function useDashboardState({ bmi, entryCount }: Args): DashboardView {
  const hc = useAppSelector(selectHealthConnect);
  const providerIssue = useAppSelector(selectHealthConnectProviderIssue);
  const nudge = useAppSelector(selectWeightNudge);
  const loading = useAppSelector(selectCheckInsUnsettled);
  const pendingCount = useAppSelector(selectPendingCount);
  const pendingIds = useAppSelector(selectPendingEntityIds);
  const failedCount = useAppSelector(selectFailedCount);
  const failedIds = useAppSelector(selectFailedEntityIds);
  const isOffline = useAppSelector(state => !state.connectivity.isOnline);
  /**
   * Only worth saying while we are online: offline already has its own
   * banner, and two notices about the same connection would be noise.
   */
  const pullFailed = useAppSelector(
    state => state.checkins.lastPullFailed && state.connectivity.isOnline,
  );
  const goals = useAppSelector(state => ({
    steps: state.profile.stepGoal,
    water: state.profile.waterGoalMl,
    sleep: state.profile.sleepGoalMinutes,
  }));

  // "Not now" hides the prompt for this session; the real rule is ~7 days.
  const [promptDismissed, setPromptDismissed] = useState(false);
  const dismissPrompt = useCallback(() => setPromptDismissed(true), []);

  return useMemo<DashboardView>(() => {
    // A device that can never use Health Connect shows no card at all — not a
    // greyed one, and never a prompt that could not possibly succeed.
    // A device whose provider is merely missing, off or stale keeps the card,
    // because there is something the user can actually do.
    const notSupported = hc.status === 'NOT_SUPPORTED';

    // Suppressed until the device has actually been asked: offering "Connect
    // Health Connect" to someone who connected months ago, for the moment the
    // first read takes, reads as the app having forgotten them.
    const disconnected = hc.hasChecked && hc.status === 'NOT_CONNECTED';

    const metric = (
      value: number | null,
      goal: number | null,
      denied = false,
    ): Metric => {
      // Before the first read, every field looks denied because the slice is
      // holding defaults. Neutral "no data" is the honest placeholder; an
      // "Allow" link would be asking for permission we may already have.
      if (denied && hc.hasChecked) {
        return { state: 'notConnected', value: null, progress: 0 };
      }
      // Permission granted but nothing recorded yet is neutral, not an error.
      if (value === null) {
        return { state: 'noData', value: null, progress: 0 };
      }
      return { state: 'value', value, progress: ratio(value, goal) };
    };

    const steps = metric(
      hc.today.steps,
      goals.steps,
      hc.availability.steps === 'PERMISSION_DENIED',
    );
    const sleep = metric(
      hc.today.sleepMinutes,
      goals.sleep,
      hc.availability.sleep === 'PERMISSION_DENIED',
    );
    const water = metric(
      hc.today.waterMl,
      goals.water,
      hc.availability.water === 'PERMISSION_DENIED',
    );

    const syncedLabel =
      hc.today.syncedAt !== null
        ? `Synced ${new Date(hc.today.syncedAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}`
        : 'Not synced yet';

    // With real permissions the footer has to say which of the three rings
    // the user actually allowed — a "Synced" time under two empty rings
    // reads as a sync failure rather than a permission the user turned off.
    const RING_FIELDS = ['steps', 'sleep', 'water'] as const;
    const grantedRings = RING_FIELDS.filter(
      field => hc.availability[field] !== 'PERMISSION_DENIED',
    ).length;
    const nothingRecorded =
      grantedRings > 0 &&
      steps.value === null &&
      sleep.value === null &&
      water.value === null;

    const footerLabel = !hc.hasChecked
      ? 'Checking Health Connect…'
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
      failedCount,
      failedIds,
      isOffline,
      pullFailed,
      nudge,
      today: {
        providerIssue,
        /**
         * A provider issue suppresses both the permission prompt and the
         * footer: "Connect" cannot succeed while the provider is unusable, and
         * "0 of 3 permissions on" would blame the user for something that is
         * not about permissions at all.
         */
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
    failedCount,
    failedIds,
    goals.sleep,
    goals.steps,
    goals.water,
    hc,
    isOffline,
    pullFailed,
    loading,
    nudge,
    pendingCount,
    pendingIds,
    promptDismissed,
    providerIssue,
  ]);
}
