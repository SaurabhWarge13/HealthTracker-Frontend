import React, { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { toastConfig } from '@/components/toast';
import { useDeepLinks } from '@/hooks/useDeepLinks';
import { useTheme } from '@/hooks/useTheme';
import { TOAST_MS } from '@/hooks/useToast';
import { selectHasSession } from '@/store/auth/authSelectors';
import { useAppSelector } from '@/store/hooks';
import { selectProfileComplete } from '@/store/profile/profileSelectors';
import { fonts, spacing } from '@/theme';
import { AuthStack } from './AuthStack';
import { MainStack } from './MainStack';
import { navigationRef } from './navigationRef';
import { OnboardingStack } from './OnboardingStack';

type ActiveStack = 'auth' | 'onboarding' | 'main';

const NAV_FONTS: NavigationTheme['fonts'] = {
  regular: { fontFamily: fonts.regular, fontWeight: '400' },
  medium: { fontFamily: fonts.medium, fontWeight: '500' },
  bold: { fontFamily: fonts.semibold, fontWeight: '600' },
  heavy: { fontFamily: fonts.bold, fontWeight: '700' },
};

export function RootNavigator() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const hasSession = useAppSelector(selectHasSession);
  const profileComplete = useAppSelector(selectProfileComplete);
  const [containerReady, setContainerReady] = useState(false);

  const activeStack: ActiveStack = !hasSession
    ? 'auth'
    : !profileComplete
    ? 'onboarding'
    : 'main';

  useDeepLinks(containerReady);

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      fonts: NAV_FONTS,
      colors: {
        ...base.colors,
        primary: colors.userAccent,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.statusOffTrack,
      },
    };
  }, [colors, isDark]);

  const handleReady = useCallback(() => setContainerReady(true), []);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={handleReady}
    >
      {activeStack === 'auth' ? (
        <AuthStack />
      ) : activeStack === 'onboarding' ? (
        <OnboardingStack />
      ) : (
        <MainStack />
      )}

      <Toast
        config={toastConfig}
        position="top"
        topOffset={insets.top + spacing.sm}
        visibilityTime={TOAST_MS.info}
        autoHide
        swipeable
      />
    </NavigationContainer>
  );
}
