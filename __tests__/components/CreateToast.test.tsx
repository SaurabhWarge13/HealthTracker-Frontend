/**
 * The first component test in this repo. Note `render` is async in
 * @testing-library/react-native 14 — it must be awaited or every query
 * afterwards reports "`render` function has not been called".
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { CreateToast, type ToastVariant } from '@/components/toast';
import { ThemeProvider } from '@/context/ThemeContext';

const renderToast = (ui: React.ReactElement) =>
  render(ui, { wrapper: ThemeProvider });

describe('CreateToast', () => {
  it('renders the message it is given', async () => {
    const { getByText } = await renderToast(
      <CreateToast text="Welcome back" variant="success" />,
    );
    expect(getByText('Welcome back')).toBeTruthy();
  });

  it('renders nothing without a message', async () => {
    const { toJSON } = await renderToast(<CreateToast variant="error" />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing for an empty string', async () => {
    const { toJSON } = await renderToast(<CreateToast text="" variant="error" />);
    expect(toJSON()).toBeNull();
  });

  /**
   * The live region is what makes a toast reachable at all on a screen
   * reader — it appears and disappears without focus ever moving to it.
   */
  it.each<ToastVariant>(['success', 'error', 'info'])(
    'announces the %s variant politely',
    async variant => {
      const { toJSON } = await renderToast(
        <CreateToast text="Something happened" variant={variant} />,
      );
      expect(toJSON()).toHaveProperty(
        'props.accessibilityLiveRegion',
        'polite',
      );
    },
  );

  it('marks an error as an alert', async () => {
    const { getByRole } = await renderToast(
      <CreateToast text="Server is down" variant="error" />,
    );
    expect(getByRole('alert')).toBeTruthy();
  });

  /**
   * Spec §4.4: a queued check-in is safe on the device, not an error. The
   * neutral variant must not escalate itself to an assertive announcement.
   */
  it('does not raise an alert on the neutral variant', async () => {
    const { queryByRole } = await renderToast(
      <CreateToast text="Saved on this device" variant="info" />,
    );
    expect(queryByRole('alert')).toBeNull();
  });
});
