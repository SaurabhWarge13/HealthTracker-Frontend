import { createSelector } from '@reduxjs/toolkit';
import { providerIssueFor } from '@/domain/healthConnect/provider';
import type { RootState } from '@/store/rootReducer';
import { selectLatestCheckIn } from '@/store/checkins/checkinsSelectors';

export const selectHealthConnect = (state: RootState) => state.healthConnect;

export const selectHealthConnectStatus = (state: RootState) =>
  state.healthConnect.status;

export const selectTodayReadings = (state: RootState) =>
  state.healthConnect.today;

export const selectHealthConnectSyncing = (state: RootState) =>
  state.healthConnect.syncing;

/**
 * On a device that can never use Health Connect we show nothing at all, not a
 * grey card. Keyed on NOT_SUPPORTED alone: the provider states mean "supported,
 * but something is in the way", so they keep the card and let it carry a fix.
 */
export const selectHealthConnectSupported = createSelector(
  selectHealthConnectStatus,
  status => status !== 'NOT_SUPPORTED',
);

/**
 * Which fixable provider problem needs fixing, or null when there is nothing
 * to do. Screens render the CTA from this rather than testing statuses.
 */
export const selectHealthConnectProviderIssue = createSelector(
  selectHealthConnectStatus,
  providerIssueFor,
);

export const selectHealthConnectUsable = createSelector(
  selectHealthConnectStatus,
  status => status === 'CONNECTED' || status === 'PARTIALLY_CONNECTED',
);

/**
 * Shown only when Health Connect's reading is newer than the last check-in,
 * differs meaningfully, and has not already been dismissed. It is a prompt to
 * act — never a second weight displayed beside the user's own.
 */
const MEANINGFUL_DIFFERENCE_KG = 0.2;

export const selectWeightNudge = createSelector(
  [selectHealthConnect, selectLatestCheckIn],
  (hc, latest) => {
    const { weightKg, weightRecordedAt } = hc.today;
    if (weightKg === null || weightRecordedAt === null) {
      return null;
    }
    if (hc.dismissedWeightAt === weightRecordedAt) {
      return null;
    }
    if (latest !== null) {
      if (weightRecordedAt <= latest.createdAt) {
        return null;
      }
      if (Math.abs(weightKg - latest.weightKg) < MEANINGFUL_DIFFERENCE_KG) {
        return null;
      }
    }
    return { weightKg, recordedAt: weightRecordedAt };
  },
);
