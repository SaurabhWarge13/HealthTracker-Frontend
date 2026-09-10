import type { TextStyle } from 'react-native';
import { moderateScale } from 'react-native-size-matters';

export const fonts = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
} as const;

const SCALE_FACTOR = 0.3;

/** Scale a design-time (390pt) size to the current device. */
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
  /** 38/700 — the one dominant number on a screen (current weight). */
  hero: variant(fonts.bold, 38, 38, -1),
  /** 24/700 — screen titles, large field values, baseline weight. */
  title: variant(fonts.bold, 24, 30, -0.3),
  /** 17/600 — card headers, nav titles, dialog titles. */
  cardTitle: variant(fonts.semibold, 17, 22),
  /** 14/600 — list row titles (check-in dates). */
  rowTitle: variant(fonts.semibold, 14, 18),
  /** 15/500 — body copy, inputs, row labels and values. */
  body: variant(fonts.medium, 15, 22),
  /** 15/600 — button labels, menu items. */
  bodyStrong: variant(fonts.semibold, 15, 20),
  /** 13/500 — secondary copy, dialog body, detail dates. */
  bodySmall: variant(fonts.medium, 13, 20),
  /** 13/600 — text links, delta line, inline actions. */
  bodySmallStrong: variant(fonts.semibold, 13, 18),
  /** 13/700 — ring values. */
  statValue: variant(fonts.bold, 13, 17),
  /** 12/500 — field labels. */
  label: variant(fonts.medium, 12, 16),
  /** 12/400 — card subtitles, header dates, email. */
  caption: variant(fonts.regular, 12, 16),
  /** 12/600 — pills and badges. */
  captionStrong: variant(fonts.semibold, 12, 16),
  /** 11/400 — footnotes, row meta, goal denominators, legends. */
  micro: variant(fonts.regular, 11, 16),
  /** 11/500 — uppercase overlines (STEPS, header date, tab labels). */
  overline: variant(fonts.medium, 11, 14, 0.9),
  /** 11/600 — small chips (Health Connect / Manual), active tab label. */
  chip: variant(fonts.semibold, 11, 14),
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof text;

/** Mixin for any number that must align on the decimal (weights, steps). */
export const numeric: TextStyle = {
  fontVariant: ['tabular-nums'],
};
