import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';
import { profileCompleted } from '@/store/profile/profileSlice';

export type OnboardingStep = 1 | 2 | 3 | 4;

export type HealthConnectChoice = 'pending' | 'connect' | 'skipped';

export type OnboardingState = {
  step: OnboardingStep;
  name: string;
  healthConnectChoice: HealthConnectChoice;
  weightKg: number | null;
  heightCm: number | null;
  stepGoal: number | null;
  waterGoalMl: number | null;
  sleepGoalMinutes: number | null;
  targetWeightKg: number | null;
};

export const initialOnboardingState: OnboardingState = {
  step: 1,
  name: '',
  healthConnectChoice: 'pending',
  weightKg: null,
  heightCm: null,
  stepGoal: null,
  waterGoalMl: null,
  sleepGoalMinutes: null,
  targetWeightKg: null,
};

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState: initialOnboardingState,
  reducers: {
    stepEntered(state, action: PayloadAction<OnboardingStep>) {
      state.step = action.payload;
    },
    nameSaved(state, action: PayloadAction<string>) {
      state.name = action.payload.trim();
    },
    healthConnectChosen(
      state,
      action: PayloadAction<Exclude<HealthConnectChoice, 'pending'>>,
    ) {
      state.healthConnectChoice = action.payload;
    },
    baselineSaved(
      state,
      action: PayloadAction<{ weightKg: number; heightCm: number }>,
    ) {
      state.weightKg = action.payload.weightKg;
      state.heightCm = action.payload.heightCm;
    },
    goalsSaved(
      state,
      action: PayloadAction<{
        stepGoal: number | null;
        waterGoalMl: number | null;
        sleepGoalMinutes: number | null;
        targetWeightKg: number | null;
      }>,
    ) {
      state.stepGoal = action.payload.stepGoal;
      state.waterGoalMl = action.payload.waterGoalMl;
      state.sleepGoalMinutes = action.payload.sleepGoalMinutes;
      state.targetWeightKg = action.payload.targetWeightKg;
    },
    draftCleared() {
      return initialOnboardingState;
    },
  },
  extraReducers: builder => {
    builder.addCase(profileCompleted, () => initialOnboardingState);

    builder.addCase(loggedOut, () => initialOnboardingState);
  },
});

export const {
  stepEntered,
  nameSaved,
  healthConnectChosen,
  baselineSaved,
  goalsSaved,
  draftCleared,
} = onboardingSlice.actions;

export const onboardingReducer = onboardingSlice.reducer;
