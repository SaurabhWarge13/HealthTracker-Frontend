import type { RootState } from '@/store/rootReducer';
import type { OnboardingState } from './onboardingSlice';

export const selectOnboardingDraft = (state: RootState): OnboardingState =>
  state.onboarding;

export const selectOnboardingStep = (state: RootState) => state.onboarding.step;

export const selectBaselineWeight = (state: RootState) =>
  state.onboarding.weightKg;
