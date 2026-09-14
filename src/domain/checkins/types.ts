export type Mood = 1 | 2 | 3 | 4 | 5;

export type FieldSource = 'healthConnect' | 'manual';

export type SourcedField = 'weight' | 'steps' | 'sleep' | 'water';

export type CheckInSources = Partial<Record<SourcedField, FieldSource>>;

export type CheckIn = {
  id: string;
  createdAt: number;
  weightKg: number;
  heightCm: number | null;
  steps: number | null;
  sleepMinutes: number | null;
  waterMl: number | null;
  mood: Mood | null;
  notes: string;
  sources: CheckInSources;
};

export type CheckInDraft = Omit<CheckIn, 'id' | 'createdAt'>;

export const MOOD_LABELS: Record<Mood, string> = {
  1: 'Rough',
  2: 'Low',
  3: 'Steady',
  4: 'Feeling good',
  5: 'Great',
};
