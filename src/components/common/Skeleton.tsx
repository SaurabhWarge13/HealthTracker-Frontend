import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { radius, type ColorName } from '@/theme';

export type SkeletonShape = 'bar' | 'box' | 'circle' | 'pill';

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  shape?: SkeletonShape;
  tone?: Extract<ColorName, 'skeleton' | 'skeletonStrong'>;
  style?: StyleProp<ViewStyle>;
};

const RADIUS: Record<SkeletonShape, number> = {
  bar: radius.pill,
  box: radius.inner,
  circle: radius.pill,
  pill: radius.pill,
};

export function Skeleton({
  width,
  height = 12,
  shape = 'bar',
  tone = 'skeleton',
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height: shape === 'circle' ? width ?? height : height,
          borderRadius: RADIUS[shape],
          backgroundColor: colors[tone],
          opacity,
        },
        style,
      ]}
    />
  );
}
