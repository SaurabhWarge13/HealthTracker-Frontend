import React from 'react';
import { AppScreen } from '@/components/common';
import { CheckInMissingCard } from '@/components/checkins';
import { ScreenHeader } from '@/components/layout';
import type { MainStackScreenProps } from '@/types/navigation';

export function CheckInNotFoundScreen({
  navigation,
}: MainStackScreenProps<'CheckInNotFound'>) {
  return (
    <AppScreen
      padded
      header={
        <ScreenHeader variant="nav" title="Check-in" onBack={navigation.goBack} />
      }
    >
      <CheckInMissingCard
        onBackToHistory={() => navigation.navigate('Tabs', { screen: 'History' })}
      />
    </AppScreen>
  );
}
