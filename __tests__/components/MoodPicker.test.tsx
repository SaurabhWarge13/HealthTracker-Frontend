import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { MoodPicker } from '@/components/checkins/MoodPicker';
import { MOOD_LABELS } from '@/domain/checkins/types';
import { ThemeProvider } from '@/context/ThemeContext';
import type { Mood } from '@/domain/checkins/types';

const PICKER = 'mood-picker';

const renderPicker = async (
  value: Mood | null,
  onChange: (mood: Mood) => void = jest.fn(),
  width = 330,
) => {
  const utils = await render(
    <MoodPicker value={value} onChange={onChange} testID={PICKER} />,
    { wrapper: ThemeProvider },
  );
  await act(async () => {
    fireEvent(utils.getByTestId(PICKER), 'layout', {
      nativeEvent: { layout: { width, height: 56, x: 0, y: 0 } },
    });
  });
  return utils;
};

describe('MoodPicker', () => {
  it('renders a face per mood once it has been measured', async () => {
    const { getAllByRole } = await renderPicker(null);
    expect(getAllByRole('radio')).toHaveLength(5);
  });

  it('reports nothing selected before a choice is made', async () => {
    const { getAllByRole, getByText } = await renderPicker(null);
    for (const face of getAllByRole('radio')) {
      expect(face.props.accessibilityState.selected).toBe(false);
    }
    expect(getByText('Nothing selected — mood is optional.')).toBeTruthy();
  });

  it('calls onChange with the mood that was tapped', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderPicker(null, onChange);
    fireEvent.press(getByLabelText(MOOD_LABELS[4]));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('marks only the chosen face as selected', async () => {
    const { getByLabelText } = await renderPicker(4);
    expect(getByLabelText(MOOD_LABELS[4]).props.accessibilityState.selected).toBe(
      true,
    );
    expect(getByLabelText(MOOD_LABELS[1]).props.accessibilityState.selected).toBe(
      false,
    );
  });

  it('names the chosen mood in the caption', async () => {
    const { getByText } = await renderPicker(2);
    expect(getByText(MOOD_LABELS[2])).toBeTruthy();
  });

  it('keeps every face square, selected or not, with a radius of half its side', async () => {
    const { getAllByRole } = await renderPicker(3);
    for (const face of getAllByRole('radio')) {
      const style = StyleSheetFlatten(face.props.style);
      expect(style.width).toBe(style.height);
      expect(style.borderRadius).toBe(style.width / 2);
    }
  });

  it('shrinks the faces so all five fit a narrow screen', async () => {
    const { getAllByRole } = await renderPicker(null, jest.fn(), 260);
    const style = StyleSheetFlatten(getAllByRole('radio')[0].props.style);
    expect(style.width * 5 + 8 * 4).toBeLessThanOrEqual(260);
  });

  it('caps the faces at the design size on a wide screen', async () => {
    const { getAllByRole } = await renderPicker(null, jest.fn(), 600);
    const style = StyleSheetFlatten(getAllByRole('radio')[0].props.style);
    expect(style.width).toBe(56);
  });
});

const StyleSheetFlatten = (style: unknown): Record<string, number> =>
  Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]));
