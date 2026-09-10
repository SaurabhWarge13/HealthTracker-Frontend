import React from 'react';
import type { TextInput } from 'react-native';
import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { AppInput, type AppInputProps } from '@/components/common';

export type ControlledInputProps<
  TValues extends FieldValues,
  TTransformed extends FieldValues = TValues,
> = Omit<AppInputProps, 'value' | 'onChangeText' | 'onBlur' | 'error'> & {
  control: Control<TValues, unknown, TTransformed>;
  name: FieldPath<TValues>;
  inputRef?: React.Ref<TextInput>;
  /**
   * Fires alongside the form update. The check-in form uses it to notice the
   * first edit of a field, which is what flips its source chip to "Manual".
   */
  onValueChange?: (text: string) => void;
};

export function ControlledInput<
  TValues extends FieldValues,
  TTransformed extends FieldValues = TValues,
>({
  control,
  name,
  inputRef,
  onValueChange,
  ...rest
}: ControlledInputProps<TValues, TTransformed>) {
  const { field, fieldState } = useController({ control, name });

  const handleChange = (text: string) => {
    field.onChange(text);
    onValueChange?.(text);
  };

  return (
    <AppInput
      ref={inputRef}
      value={field.value ?? ''}
      onChangeText={handleChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
      {...rest}
    />
  );
}
