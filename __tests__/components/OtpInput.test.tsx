import React from 'react';
import { render } from '@testing-library/react-native';
import { OtpInput } from '@/components/forms';
import { ThemeProvider } from '@/context/ThemeContext';
import { OTP_LENGTH } from '@/domain/auth/validation';

const renderOtp = async (ui: React.ReactElement) => {
  const view = await render(ui, { wrapper: ThemeProvider });
  return { ...view, field: view.getByLabelText('Verification code') };
};

describe('OtpInput — one field, drawn as boxes', () => {
  it('exposes exactly one accessible field, not one per box', async () => {
    const { field, queryAllByLabelText } = await renderOtp(
      <OtpInput value="" onChange={jest.fn()} />,
    );
    expect(field).toBeTruthy();
    expect(queryAllByLabelText('Verification code')).toHaveLength(1);
  });

  it('passes digits straight through', async () => {
    const onChange = jest.fn();
    const { field } = await renderOtp(<OtpInput value="" onChange={onChange} />);

    field.props.onChangeText('1234');
    expect(onChange).toHaveBeenCalledWith('1234');
  });

  it('strips everything that is not a digit', async () => {
    const onChange = jest.fn();
    const { field } = await renderOtp(<OtpInput value="" onChange={onChange} />);

    field.props.onChangeText('1-2 3a4\n');
    expect(onChange).toHaveBeenCalledWith('1234');
  });

  it('caps the value at the code length, however much arrives', async () => {
    const onChange = jest.fn();
    const { field } = await renderOtp(<OtpInput value="" onChange={onChange} />);

    field.props.onChangeText('123456789');
    expect(onChange).toHaveBeenCalledWith('1234');
    expect(onChange.mock.calls[0][0]).toHaveLength(OTP_LENGTH);
  });

  it('fires onComplete when the last digit lands, and not before', async () => {
    const onComplete = jest.fn();
    const { field } = await renderOtp(
      <OtpInput value="123" onChange={jest.fn()} onComplete={onComplete} />,
    );

    field.props.onChangeText('123');
    expect(onComplete).not.toHaveBeenCalled();

    field.props.onChangeText('1234');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('hands onComplete the finished code, not the stale one', async () => {
    const onComplete = jest.fn();
    const { field } = await renderOtp(
      <OtpInput value="123" onChange={jest.fn()} onComplete={onComplete} />,
    );

    field.props.onChangeText('1234');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('hands onComplete the stripped and capped code', async () => {
    const onComplete = jest.fn();
    const { field } = await renderOtp(
      <OtpInput value="" onChange={jest.fn()} onComplete={onComplete} />,
    );

    field.props.onChangeText('1-2 3a4 5');
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('fires onComplete once per keystroke that completes the code', async () => {
    const onComplete = jest.fn();
    const { field } = await renderOtp(
      <OtpInput value="1234" onChange={jest.fn()} onComplete={onComplete} />,
    );

    field.props.onChangeText('12345');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders the digits it was given', async () => {
    const { getByText } = await renderOtp(<OtpInput value="12" onChange={jest.fn()} />);
    expect(getByText('1')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });
});
