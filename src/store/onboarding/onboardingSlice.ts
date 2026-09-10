import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { loggedOut } from '@/store/auth/authSlice';
import { profileCompleted } from '@/store/profile/profileSlice';

export type OnboardingStep = 1 | 2 | 3 | 4;

/**
 * Health Connect is a deliberate choice, not a default: the user must pick
 * one before leaving step 2, and we never re-prompt after a skip.
 */
export type HealthConnectChoice = 'pending' | 'connect' | 'skipped';

export type OnboardingState = {
  step: OnboardingStep;
  name: string;
  /**
   * Which button the user pressed on step 2 — a record that they were asked
   * and answered, nothing more.
   *
   * NOT the connection state. Permissions are granted and revoked outside
   * this app, so this goes stale the moment anything changes in system
   * settings; screens read `state.healthConnect.status` instead. Treating
   * this as truth is what made step 3 offer to connect an already-connected
   * device.
   */
  healthConnectChoice: HealthConnectChoice;
  weightKg: number | null;
  heightCm: number | null;
  stepGoal: number | null;
  /** Integer millilitres even though the UI shows litres. */
  waterGoalMl: number | null;
  /** Minutes even though the UI asks for hours, matching a check-in. */
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
    /**
     * Both fields are required on step 3, so neither arrives null. The state
     * they land in stays nullable — the draft starts empty and step 3 may not
     * have been reached yet.
     */
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
    /**
     * The draft is scratch space. Once `Finish setup` has copied it into the
     * profile it has no reason to exist, and leaving it behind means a second
     * stale copy of the user's name, weight, height and goals sits in MMKV
     * shadowing the real one — waiting for some future "resume onboarding"
     * check to trust it.
     *
     * Handled here rather than in GoalsScreen so the invariant belongs to the
     * slice: no call site has to remember to tidy up after itself.
     */
    builder.addCase(profileCompleted, () => initialOnboardingState);

    /**
     * Same reasoning, different trigger: the draft holds the user's name,
     * weight, height and goals, so it is account-scoped and cannot outlive
     * the account. Logout is the boundary (authSlice).
     */
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
