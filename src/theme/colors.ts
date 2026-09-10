const palette = {
  // user / check-in data
  green900: '#0D5F4E',
  green900Pressed: '#0A4C3E',
  green700: '#167A62',
  greenChart: '#A9CFC2',
  greenChartSoft: '#C9DAD3',
  greenTint: '#E8F2EF',
  greenTintPressed: '#DCEAE5',
  greenBright: '#4FC79E', // dark-mode lift
  greenBrightPressed: '#63D2AC',
  greenDeep: '#07231C', // dark-mode text on accent

  // device / Health Connect data
  slate700: '#3F5A70',
  slate700Pressed: '#34495C',
  slate300: '#C3D0DA',
  slateTrack: '#E3E9EE',
  slateTrackOff: '#E9ECEA',
  slateIconMuted: '#B4BEC5',
  slateTint: '#EDF1F4',
  slateTintPressed: '#E2E8ED',
  slateBright: '#8AA5BC', // dark-mode lift
  slateBrightPressed: '#9BB4C8',

  // neutrals — light
  ink: '#10161A',
  muted: '#5F6C72',
  hint: '#8A9299',
  page: '#EFF1F0',
  card: '#FFFFFF',
  divider: '#E6E9E7',
  headerBand: '#DCEAE4',
  headerBandText: '#4E6D62',
  statTile: '#F4F8F6',
  neutral: '#F1F3F2',
  neutralPressed: '#E9EBEA',
  skeleton: '#EDEFEE',
  skeletonStrong: '#E9EBEA',
  disabled: '#A9BFB8',
  white: '#FFFFFF',

  // neutrals — dark (values read off the dark artboards)
  pageDark: '#0E1412',
  cardDark: '#18201D',
  dividerDark: '#232C29',
  headerBandDark: '#16241F',
  headerBandTextDark: '#8FB3A6',
  statTileDark: '#131B18',
  neutralDark: '#1C2320',
  neutralPressedDark: '#262F2C',
  greenTintDark: '#1B2A25',
  greenTintPressedDark: '#21332C',
  greenChartDark: '#35705C',
  greenChartSoftDark: '#2E4038',
  slateTintDark: '#1E2A33',
  slateTrackDark: '#2A363F',
  slateIconMutedDark: '#4C5A62',
  inkDark: '#F2F5F3',
  mutedDark: '#9AA5A2',
  hintDark: '#6E7A78',
  skeletonDark: '#1C2320',
  skeletonStrongDark: '#232C29',
  disabledDark: '#2E3B37',

  // status
  statusImproving: '#167A62',
  statusSteady: '#B07A1F',
  statusOffTrack: '#C0553B',
  statusOffTrackTint: '#FBF3F1',
  statusUnknown: '#8A9299',
  statusImprovingDark: '#4FC79E',
  statusSteadyDark: '#D9A94E',
  statusOffTrackDark: '#E0806A',
  statusOffTrackTintDark: '#2A1E1B',
  statusUnknownDark: '#6E7A78',
} as const;

export type ThemeColors = {
  /** Check-in / user-asserted data. Icon tiles, primary buttons, chart line. */
  userAccent: string;
  userAccentPressed: string;
  userTint: string;
  userTintPressed: string;
  userChart: string;
  userChartSoft: string;
  /** Health Connect / device-observed data. Icon tiles, rings, source chips. */
  deviceAccent: string;
  deviceAccentPressed: string;
  deviceTint: string;
  deviceTintPressed: string;
  deviceTrack: string;
  deviceTrackOff: string;
  deviceIconMuted: string;

  textPrimary: string;
  textMuted: string;
  textHint: string;
  textOnAccent: string;

  background: string;
  surface: string;
  surfaceTint: string;
  surfaceNeutral: string;
  surfaceNeutralPressed: string;
  headerBand: string;
  headerBandText: string;
  border: string;

  danger: string;
  dangerTint: string;
  disabledFill: string;
  skeleton: string;
  skeletonStrong: string;
  /** Dialog overlay. Darker in dark mode so the card still separates. */
  scrim: string;

  statusImproving: string;
  statusSteady: string;
  statusOffTrack: string;
  statusUnknown: string;
};

export const lightColors: ThemeColors = {
  userAccent: palette.green900,
  userAccentPressed: palette.green900Pressed,
  userTint: palette.greenTint,
  userTintPressed: palette.greenTintPressed,
  userChart: palette.greenChart,
  userChartSoft: palette.greenChartSoft,
  deviceAccent: palette.slate700,
  deviceAccentPressed: palette.slate700Pressed,
  deviceTint: palette.slateTint,
  deviceTintPressed: palette.slateTintPressed,
  deviceTrack: palette.slateTrack,
  deviceTrackOff: palette.slateTrackOff,
  deviceIconMuted: palette.slateIconMuted,

  textPrimary: palette.ink,
  textMuted: palette.muted,
  textHint: palette.hint,
  textOnAccent: palette.white,

  background: palette.page,
  surface: palette.card,
  surfaceTint: palette.statTile,
  surfaceNeutral: palette.neutral,
  surfaceNeutralPressed: palette.neutralPressed,
  headerBand: palette.headerBand,
  headerBandText: palette.headerBandText,
  border: palette.divider,

  danger: palette.statusOffTrack,
  dangerTint: palette.statusOffTrackTint,
  disabledFill: palette.disabled,
  skeleton: palette.skeleton,
  skeletonStrong: palette.skeletonStrong,
  scrim: 'rgba(16, 22, 26, 0.45)',

  statusImproving: palette.statusImproving,
  statusSteady: palette.statusSteady,
  statusOffTrack: palette.statusOffTrack,
  statusUnknown: palette.statusUnknown,
};

export const darkColors: ThemeColors = {
  userAccent: palette.greenBright,
  userAccentPressed: palette.greenBrightPressed,
  userTint: palette.greenTintDark,
  userTintPressed: palette.greenTintPressedDark,
  userChart: palette.greenChartDark,
  userChartSoft: palette.greenChartSoftDark,
  deviceAccent: palette.slateBright,
  deviceAccentPressed: palette.slateBrightPressed,
  deviceTint: palette.slateTintDark,
  deviceTintPressed: palette.slateTintDark,
  deviceTrack: palette.slateTrackDark,
  deviceTrackOff: palette.slateTrackDark,
  deviceIconMuted: palette.slateIconMutedDark,

  textPrimary: palette.inkDark,
  textMuted: palette.mutedDark,
  textHint: palette.hintDark,
  textOnAccent: palette.greenDeep,

  background: palette.pageDark,
  surface: palette.cardDark,
  surfaceTint: palette.statTileDark,
  surfaceNeutral: palette.neutralDark,
  surfaceNeutralPressed: palette.neutralPressedDark,
  headerBand: palette.headerBandDark,
  headerBandText: palette.headerBandTextDark,
  border: palette.dividerDark,

  danger: palette.statusOffTrackDark,
  dangerTint: palette.statusOffTrackTintDark,
  disabledFill: palette.disabledDark,
  skeleton: palette.skeletonDark,
  skeletonStrong: palette.skeletonStrongDark,
  scrim: 'rgba(0, 0, 0, 0.62)',

  statusImproving: palette.statusImprovingDark,
  statusSteady: palette.statusSteadyDark,
  statusOffTrack: palette.statusOffTrackDark,
  statusUnknown: palette.statusUnknownDark,
};

export type ColorName = keyof ThemeColors;
