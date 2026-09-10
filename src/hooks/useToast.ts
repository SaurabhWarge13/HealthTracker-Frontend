import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import type { ToastVariant } from '@/components/toast/CreateToast';

/**
 * An error has to be read and acted on, so it gets longest. A success is a
 * receipt for something the user just did and already expects.
 */
export const TOAST_MS: Record<ToastVariant, number> = {
  success: 2500,
  info: 3500,
  error: 4500,
};

/**
 * Exported as a plain function as well as a hook so non-React callers (the
 * sync engine) share one entry point. `Toast.show` is a singleton call rather
 * than a `setState`, so firing it from an async handler whose screen has since
 * unmounted is safe — which is what happens on sign-in, where `sessionStarted`
 * swaps the stack out from under the Login screen before the await resolves.
 */
export function showToast(
  message: string,
  variant: ToastVariant = 'info',
  visibilityTime: number = TOAST_MS[variant],
): void {
  Toast.show({ type: variant, text1: message, visibilityTime });
}

/** The screen-facing API. The returned function is stable across renders. */
export function useToast() {
  return useCallback(showToast, []);
}
