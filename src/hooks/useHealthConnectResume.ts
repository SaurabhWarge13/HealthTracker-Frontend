import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useHealthConnect } from './useHealthConnect';

export function useHealthConnectResume(): void {
  const { refresh } = useHealthConnect();
  const previous = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    refresh();

    const subscription = AppState.addEventListener('change', next => {
      const wasAway = previous.current !== 'active';
      previous.current = next;
      if (wasAway && next === 'active') {
        refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);
}
