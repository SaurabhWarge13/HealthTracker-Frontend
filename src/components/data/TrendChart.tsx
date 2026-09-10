import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { AppText } from '@/components/common';
import type { Trend } from '@/domain/progress/trend';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';
import { formatWeight, formatWeightWithUnit } from '@/utils/formatters';

export type TrendChartProps = {
  trend: Trend;
  height?: number;
};

const PAD_X = 6;
const PAD_Y = 12;

export function TrendChart({ trend, height = 78 }: TrendChartProps) {
  const { colors } = useTheme();
  // Width comes from layout rather than a fixed viewBox, so the line stays
  // true on every screen size instead of being stretched.
  const [width, setWidth] = useState(0);

  const { points, minKg, maxKg, targetKg } = trend;
  const ready = width > 0 && points.length >= 2;

  // A flat series would divide by zero; give it a nominal band instead.
  const span = maxKg - minKg || 1;
  const innerW = Math.max(1, width - PAD_X * 2);
  const innerH = Math.max(1, height - PAD_Y * 2);

  const x = (index: number) =>
    PAD_X + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (kg: number) => PAD_Y + (1 - (kg - minKg) / span) * innerH;

  const polyline = ready
    ? points.map((p, i) => `${x(i)},${y(p.weightKg)}`).join(' ')
    : '';

  const baseline = points.find(p => p.isBaseline);

  return (
    <View>
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {ready ? (
          <Svg width={width} height={height}>
            {targetKg !== null ? (
              <Line
                x1={0}
                y1={y(targetKg)}
                x2={width}
                y2={y(targetKg)}
                stroke={colors.userChart}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ) : null}

            <Polyline
              points={polyline}
              fill="none"
              stroke={colors.userAccent}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((point, index) => {
              const last = index === points.length - 1;
              // The baseline reads as an anchor, not a check-in, so it is hollow.
              if (point.isBaseline) {
                return (
                  <Circle
                    key={point.timestamp}
                    cx={x(index)}
                    cy={y(point.weightKg)}
                    r={4.6}
                    fill={colors.surface}
                    stroke={colors.userAccent}
                    strokeWidth={2.2}
                  />
                );
              }
              return (
                <Circle
                  key={point.timestamp}
                  cx={x(index)}
                  cy={y(point.weightKg)}
                  r={last ? 4.2 : 3}
                  fill={colors.userAccent}
                />
              );
            })}
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>

      <View style={styles.legend}>
        {baseline !== undefined ? (
          <View style={styles.legendItem}>
            <View
              style={[
                styles.hollowDot,
                { backgroundColor: colors.surface, borderColor: colors.userAccent },
              ]}
            />
            <AppText variant="micro" color="textHint" numeric>
              Baseline · {formatWeightWithUnit(baseline.weightKg)}
            </AppText>
          </View>
        ) : (
          <View />
        )}

        {targetKg !== null ? (
          <View style={styles.legendItem}>
            <View style={[styles.dash, { borderTopColor: colors.userChart }]} />
            <AppText variant="micro" color="textHint" numeric>
              Target {formatWeight(targetKg)}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hollowDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  dash: { width: 14, borderTopWidth: 1, borderStyle: 'dashed' },
});
