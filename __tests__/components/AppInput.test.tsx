/**
 * `render` is async in @testing-library/react-native 14 — see the note in
 * CreateToast.test.tsx.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { AppInput } from '@/components/common';
import { ThemeProvider } from '@/context/ThemeContext';

const renderInput = (ui: React.ReactElement) =>
  render(ui, { wrapper: ThemeProvider });

describe('AppInput — the message slot under the field', () => {
  it('renders a helper on its own', async () => {
    const { getByText } = await renderInput(
      <AppInput label="Sleep" value="" onChangeText={jest.fn()} helper="Up to 24h" />,
    );
    expect(getByText('Up to 24h')).toBeTruthy();
  });

  it('renders an error on its own', async () => {
    const { getByText } = await renderInput(
      <AppInput
        label="Sleep"
        value="25"
        onChangeText={jest.fn()}
        error="Enter sleep between 0 and 24 hours."
      />,
    );
    expect(getByText('Enter sleep between 0 and 24 hours.')).toBeTruthy();
  });

  /**
   * The regression this stacking exists to prevent: an error used to *replace*
   * the helper, so "Up to 24h" vanished exactly when the value was wrong.
   */
  it('shows the helper and the error together', async () => {
    const { getByText } = await renderInput(
      <AppInput
        label="Sleep"
        value="25"
        onChangeText={jest.fn()}
        helper="Up to 24h"
        error="Enter sleep between 0 and 24 hours."
      />,
    );
    expect(getByText('Enter sleep between 0 and 24 hours.')).toBeTruthy();
    expect(getByText('Up to 24h')).toBeTruthy();
  });

  it('announces the error to a screen reader', async () => {
    const { getByRole } = await renderInput(
      <AppInput label="Sleep" value="25" onChangeText={jest.fn()} error="Out of range" />,
    );
    expect(getByRole('alert')).toBeTruthy();
  });

  it('renders no message line when there is neither', async () => {
    const { queryByRole } = await renderInput(
      <AppInput label="Sleep" value="" onChangeText={jest.fn()} />,
    );
    expect(queryByRole('alert')).toBeNull();
  });
});
