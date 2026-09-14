import React from 'react';
import { Keyboard, Pressable, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { useKeyboardSafeNav } from '@/hooks/useKeyboardSafeNav';

const SETTLE_MS = 250;
const REARM_MS = 600;

function Harness({ run }: { run: () => void }) {
  const safeNav = useKeyboardSafeNav();

  return (
    <Pressable onPress={() => safeNav(run)}>
      <Text>go</Text>
    </Pressable>
  );
}

async function setup(run: () => void) {
  const view = await render(<Harness run={run} />);

  return {
    ...view,
    tap: () => fireEvent.press(view.getByText('go')),
    advance: (ms: number) =>
      act(() => {
        jest.advanceTimersByTime(ms);
      }),
  };
}

describe('useKeyboardSafeNav', () => {
  let isVisible: jest.SpyInstance;
  let dismiss: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    isVisible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs straight away when no keyboard is up', async () => {
    const run = jest.fn();
    const { tap } = await setup(run);

    tap();

    expect(run).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('dismisses the keyboard and waits before running', async () => {
    isVisible.mockReturnValue(true);
    const run = jest.fn();
    const { tap, advance } = await setup(run);

    tap();

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();

    advance(SETTLE_MS);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('ignores further taps while the first is still in flight', async () => {
    isVisible.mockReturnValue(true);
    const run = jest.fn();
    const { tap, advance } = await setup(run);

    tap();
    tap();
    tap();
    advance(SETTLE_MS);

    expect(run).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('ignores a double tap with no keyboard too, so one tap is one transition', async () => {
    const run = jest.fn();
    const { tap } = await setup(run);

    tap();
    tap();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('re-arms once the guard window has passed', async () => {
    const run = jest.fn();
    const { tap, advance } = await setup(run);

    tap();
    advance(REARM_MS);
    tap();

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('never fires after the screen has gone', async () => {
    isVisible.mockReturnValue(true);
    const run = jest.fn();
    const { tap, advance, unmount } = await setup(run);

    tap();
    unmount();
    advance(SETTLE_MS);

    expect(run).not.toHaveBeenCalled();
  });
});
