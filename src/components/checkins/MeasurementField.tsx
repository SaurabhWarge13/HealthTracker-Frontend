import React from 'react';
import type { FieldValues } from 'react-hook-form';
import { SourceChip, type DataSource } from '@/components/data';
import { ControlledInput, type ControlledInputProps } from '@/components/forms';

export type MeasurementFieldProps<
  TValues extends FieldValues,
  TTransformed extends FieldValues = TValues,
> = Omit<ControlledInputProps<TValues, TTransformed>, 'labelRight' | 'labelBadge'> & {
  /** Chip on the right of the label row. Omit when there is no source. */
  source?: DataSource;
  /** Marks the field as skippable — the "Optional" chip beside the label. */
  optional?: boolean;
};

export function MeasurementField<
  TValues extends FieldValues,
  TTransformed extends FieldValues = TValues,
>({
  source,
  optional = false,
  size = 'xl',
  // A measurement is the number the screen is about — 24/700 (artboards 1d, 4a).
  valueSize = 'display',
  keyboardType = 'decimal-pad',
  ...rest
}: MeasurementFieldProps<TValues, TTransformed>) {
  return (
    <ControlledInput
      size={size}
      valueSize={valueSize}
      keyboardType={keyboardType}
      labelBadge={optional ? <SourceChip source="optional" /> : undefined}
      labelRight={source !== undefined ? <SourceChip source={source} /> : undefined}
      {...rest}
    />
  );
}
