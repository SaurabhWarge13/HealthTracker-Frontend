import { Angry, Frown, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react-native';
import type { Mood } from '@/domain/checkins/types';

export const MOOD_ICONS: Record<Mood, LucideIcon> = {
  1: Angry,
  2: Frown,
  3: Meh,
  4: Smile,
  5: Laugh,
};

export const MOOD_VALUES: Mood[] = [1, 2, 3, 4, 5];

/** Falls back to the neutral face when a check-in has no mood recorded. */
export const moodIcon = (mood: Mood | null): LucideIcon =>
  mood === null ? Meh : MOOD_ICONS[mood];
