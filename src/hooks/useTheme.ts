import { useContext } from 'react';
import { ThemeContext } from '@/context/ThemeContext';
import type { Theme } from '@/theme';

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return theme;
}
