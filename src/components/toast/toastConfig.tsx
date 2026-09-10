import React from 'react';
import type { ToastConfig } from 'react-native-toast-message';
import { CreateToast } from './CreateToast';

export const toastConfig: ToastConfig = {
  success: ({ text1 }) => <CreateToast text={text1} variant="success" />,
  error: ({ text1 }) => <CreateToast text={text1} variant="error" />,
  info: ({ text1 }) => <CreateToast text={text1} variant="info" />,
};
