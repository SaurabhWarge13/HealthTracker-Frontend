import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { AppIcon, AppText } from '@/components/common';
import { MOOD_ICONS, MOOD_VALUES } from './MoodIcon';
import { MOOD_LABELS, type Mood } from '@/domain/checkins/types';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';

export type MoodPickerProps = {
  value: Mood | null;
  onChange: (mood: Mood) => void;
  testID?: string;
};

const MAX_FACE = 56;
const GAPS = spacing.sm * (MOOD_VALUES.length - 1);

export function MoodPicker({ value, onChange, testID }: MoodPickerProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState<number | null>(null);

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  const size =
    width === null
      ? null
      : Math.min(MAX_FACE, Math.floor((width - GAPS) / MOOD_VALUES.length));

  return (
    <View onLayout={onLayout} testID={testID}>
      {size === null ? (
        <View style={styles.placeholder} />
      ) : (
        <View style={styles.row} accessibilityRole="radiogroup">
          {MOOD_VALUES.map(mood => {
            const selected = value === mood;
            return (
              <Pressable
                key={mood}
                onPress={() => onChange(mood)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={MOOD_LABELS[mood]}
                android_ripple={{
                  color: colors.userTintPressed,
                  borderless: false,
                  radius: size / 2,
                }}
                style={[
                  styles.face,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: selected ? colors.userTint : colors.surface,
                    borderColor: selected ? colors.userAccent : colors.border,
                  },
                ]}
              >
                <AppIcon
                  icon={MOOD_ICONS[mood]}
                  size="lg"
                  color={selected ? 'userAccent' : 'textHint'}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      <AppText
        variant="micro"
        color={value === null ? 'textHint' : 'textMuted'}
        style={styles.caption}
      >
        {value === null ? 'Nothing selected — mood is optional.' : MOOD_LABELS[value]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  face: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholder: { height: MAX_FACE },
  caption: { marginTop: 10, marginHorizontal: 2 },
});
