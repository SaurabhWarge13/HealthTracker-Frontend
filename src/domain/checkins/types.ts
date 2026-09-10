/**
 * A check-in is a snapshot the user reported. Even when a field was prefilled
 * from Health Connect the saved value is the user's; `sources` only records
 * where each number originally came from.
 */
/** Five faces, no default selection — mood is optional. */
export type Mood = 1 | 2 | 3 | 4 | 5;

/** Where a single field's value came from at the moment it was saved. */
export type FieldSource = 'healthConnect' | 'manual';

/** Fields that can carry a source chip. Height is profile data, not measured. */
export type SourcedField = 'weight' | 'steps' | 'sleep' | 'water';

export type CheckInSources = Partial<Record<SourcedField, FieldSource>>;

export type CheckIn = {
  /** Client-generated so an offline check-in is renderable before the server sees it. */
  id: string;
  /** Epoch ms. Ordering is by timestamp, not date — two same-day entries are two entries. */
  createdAt: number;
  weightKg: number;
  /** The height in effect at the time, so past BMIs stay accurate. */
  heightCm: number | null;
  steps: number | null;
  sleepMinutes: number | null;
  waterMl: number | null;
  mood: Mood | null;
  notes: string;
  sources: CheckInSources;
};

/** What the form hands the store. The id and timestamp are assigned on save. */
export type CheckInDraft = Omit<CheckIn, 'id' | 'createdAt'>;

export const MOOD_LABELS: Record<Mood, string> = {
  1: 'Rough',
  2: 'Low',
  3: 'Steady',
  4: 'Feeling good',
  5: 'Great',
};
