import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

const KEYBOARD_SETTLE_MS = 250;

const REARM_MS = 600;

export function useKeyboardSafeNav(): (run: () => void) => void {
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  return useCallback((run: () => void) => {
    if (busy.current) {
      return;
    }
    busy.current = true;
    timers.current.push(
      setTimeout(() => {
        busy.current = false;
      }, REARM_MS),
    );

    if (!Keyboard.isVisible()) {
      run();
      return;
    }

    Keyboard.dismiss();
    timers.current.push(setTimeout(run, KEYBOARD_SETTLE_MS));
  }, []);
}
