import React from 'react';
import { Activity, Check, Pencil, type LucideIcon } from 'lucide-react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { AppChip, type AppChipSize, type AppChipVariant } from './AppChip';

export type DataSource =
  /** Prefilled from Health Connect and untouched. */
  | 'healthConnect'
  /** The user typed or edited this value. */
  | 'manual'
  /** Tracked continuously by the device (onboarding explainer). */
  | 'automatic'
  /** Permission granted (settings list). */
  | 'connected'
  /** Permission missing (settings list). */
  | 'notConnected'
  /** Field the user may leave blank. */
  | 'optional';

type SourcePreset = {
  label: string;
  variant: AppChipVariant;
  icon?: LucideIcon;
};

const PRESET: Record<DataSource, SourcePreset> = {
  healthConnect: { label: 'Health Connect', variant: 'device', icon: Activity },
  manual: { label: 'Manual', variant: 'user', icon: Pencil },
  automatic: { label: 'Automatic', variant: 'device' },
  connected: { label: 'Connected', variant: 'device', icon: Check },
  notConnected: { label: 'Not connected', variant: 'neutral' },
  optional: { label: 'Optional', variant: 'outlined' },
};

export type SourceChipProps = {
  source: DataSource;
  size?: AppChipSize;
  /** Override the preset label (e.g. "3 data types"). */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function SourceChip({ source, size = 'sm', label, style }: SourceChipProps) {
  const preset = PRESET[source];

  return (
    <AppChip
      label={label ?? preset.label}
      variant={preset.variant}
      size={size}
      icon={preset.icon}
      style={style}
    />
  );
}
