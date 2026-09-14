import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import type { ToastVariant } from '@/components/toast/CreateToast';

export const TOAST_MS: Record<ToastVariant, number> = {
  success: 2500,
  info: 3500,
  error: 4500,
};

export function showToast(
  message: string,
  variant: ToastVariant = 'info',
  visibilityTime: number = TOAST_MS[variant],
): void {
  Toast.show({ type: variant, text1: message, visibilityTime });
}

export function useToast() {
  return useCallback(showToast, []);
}
