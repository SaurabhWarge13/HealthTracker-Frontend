import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppScreen, AppText } from '@/components/common';
import { ScreenHeader } from '@/components/layout';
import { spacing } from '@/theme';
import { StepIndicator } from './StepIndicator';

export type OnboardingStepLayoutProps = {
  /** 1-based step number; also fills the indicator. */
  step: number;
  totalSteps?: number;
  title: string;
  /** Sentence under the title. Some steps use a note instead. */
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
  /** Pinned action(s) at the bottom. */
  footer: React.ReactNode;
};

export function OnboardingStepLayout({
  step,
  totalSteps = 4,
  title,
  subtitle,
  onBack,
  children,
  footer,
}: OnboardingStepLayoutProps) {
  return (
    <AppScreen
      scroll
      keyboardAvoiding
      header={
        <ScreenHeader
          variant="onboarding"
          opaque={false}
          onBack={onBack}
          backAccessibilityLabel="Back to the previous step"
        />
      }
      footer={footer}
      // Horizontal only: the header already supplies the gap above.
      padded="horizontal"
    >
      <StepIndicator current={step} total={totalSteps} />

      <AppText variant="micro" color="textHint" style={styles.stepCount}>
        Step {step} of {totalSteps}
      </AppText>
      <AppText variant="title">{title}</AppText>
      {subtitle !== undefined ? (
        <AppText variant="body" color="textMuted" style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}

      <View style={subtitle !== undefined ? undefined : styles.bodyGap}>
        {children}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stepCount: { marginTop: spacing.xxl, marginBottom: spacing.sm },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.xl + spacing.xs },
  bodyGap: { marginTop: spacing.xl + spacing.xs },
});
