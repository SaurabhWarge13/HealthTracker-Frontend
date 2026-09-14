import React from 'react';
import type { FieldValues } from 'react-hook-form';
import { SourceChip, type DataSource } from '@/components/data';
import { ControlledInput, type ControlledInputProps } from '@/components/forms';

export type MeasurementFieldProps<
  TValues extends FieldValues,
  TTransformed extends FieldValues = TValues,
> = Omit<ControlledInputProps<TValues, TTransformed>, 'labelRight' | 'labelBadge'> & {
  source?: DataSource;
  optional?: boolean;
};

export function MeasurementField<
  TValues extends FieldValues,
  TTransformed extends FieldValues = TValues,
>({
  source,
  optional = false,
  size = 'xl',
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
