import type { ThemeColors } from './colors';

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './radius';

export type ColorScheme = 'light' | 'dark';

/** What `useTheme()` returns. */
export type Theme = {
  colors: ThemeColors;
  scheme: ColorScheme;
  isDark: boolean;
};
