/**
 * A toast for use inside an RN `<Modal>`. The global `<Toast />` is mounted
 * under `NavigationContainer`, so one fired while a dialog is open is drawn
 * behind that dialog's native window and never seen.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { CreateToast, type ToastVariant } from './CreateToast';

export type ModalToastProps = {
  message: string;
  variant?: ToastVariant;
  /** How long it holds at full opacity, between the two 300ms animations. */
  holdMs?: number;
  /** Called once the exit animation has finished. */
  onHide: () => void;
};

const FADE_MS = 300;
const DEFAULT_HOLD_MS = 2000;
const OFFSCREEN = -24;

export function ModalToast({
  message,
  variant = 'info',
  holdMs = DEFAULT_HOLD_MS,
  onHide,
}: ModalToastProps) {
  const progress = useRef(new Animated.Value(0)).current;

  // Kept in a ref so a caller that re-creates `onHide` each render cannot
  // restart the animation half way through and strand the toast on screen.
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);

  const animate = useCallback(
    (toValue: number) =>
      Animated.timing(progress, {
        toValue,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    [progress],
  );

  useEffect(() => {
    const sequence = Animated.sequence([
      animate(1),
      Animated.delay(holdMs),
      animate(0),
    ]);

    sequence.start(({ finished }) => {
      if (finished) {
        onHideRef.current();
      }
    });

    return () => sequence.stop();
  }, [animate, holdMs, message, variant]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [OFFSCREEN, 0],
              }),
            },
          ],
        },
      ]}
    >
      <CreateToast text={message} variant={variant} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});
