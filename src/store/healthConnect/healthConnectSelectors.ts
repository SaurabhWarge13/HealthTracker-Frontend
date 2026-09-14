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

export const selectHealthConnectSupported = createSelector(
  selectHealthConnectStatus,
  status => status !== 'NOT_SUPPORTED',
);

export const selectHealthConnectProviderIssue = createSelector(
  selectHealthConnectStatus,
  providerIssueFor,
);

export const selectHealthConnectUsable = createSelector(
  selectHealthConnectStatus,
  status => status === 'CONNECTED' || status === 'PARTIALLY_CONNECTED',
);

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
