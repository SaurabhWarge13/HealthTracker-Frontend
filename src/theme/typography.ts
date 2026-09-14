import type { TextStyle } from 'react-native';
import { moderateScale } from 'react-native-size-matters';

export const fonts = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
} as const;

const SCALE_FACTOR = 0.3;

export const scaleFont = (size: number): number =>
  moderateScale(size, SCALE_FACTOR);

const variant = (
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  letterSpacing?: number,
): TextStyle => ({
  fontFamily,
  fontSize: scaleFont(fontSize),
  lineHeight: scaleFont(lineHeight),
  ...(letterSpacing !== undefined ? { letterSpacing } : null),
});

export const text = {
  hero: variant(fonts.bold, 38, 38, -1),
  title: variant(fonts.bold, 24, 30, -0.3),
  cardTitle: variant(fonts.semibold, 17, 22),
  rowTitle: variant(fonts.semibold, 14, 18),
  body: variant(fonts.medium, 15, 22),
  bodyStrong: variant(fonts.semibold, 15, 20),
  bodySmall: variant(fonts.medium, 13, 20),
  bodySmallStrong: variant(fonts.semibold, 13, 18),
  statValue: variant(fonts.bold, 13, 17),
  label: variant(fonts.medium, 12, 16),
  caption: variant(fonts.regular, 12, 16),
  captionStrong: variant(fonts.semibold, 12, 16),
  micro: variant(fonts.regular, 11, 16),
  overline: variant(fonts.medium, 11, 14, 0.9),
  chip: variant(fonts.semibold, 11, 14),
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof text;

export const numeric: TextStyle = {
  fontVariant: ['tabular-nums'],
};
