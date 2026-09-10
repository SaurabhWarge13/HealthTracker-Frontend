import type { Permission } from 'react-native-health-connect';
import type { HealthConnectField } from '@/store/healthConnect/healthConnectSlice';

/** Only the record types we touch — not the library's full union. */
export type TrackedRecordType =
  | 'Weight'
  | 'Height'
  | 'Steps'
  | 'SleepSession'
  | 'Hydration';

export const HEALTH_CONNECT_FIELDS: readonly HealthConnectField[] = [
  'weight',
  'height',
  'steps',
  'sleep',
  'water',
];

export const RECORD_TYPE_BY_FIELD: Record<HealthConnectField, TrackedRecordType> = {
  weight: 'Weight',
  height: 'Height',
  steps: 'Steps',
  sleep: 'SleepSession',
  water: 'Hydration',
};

const FIELD_BY_RECORD_TYPE: Record<TrackedRecordType, HealthConnectField> = {
  Weight: 'weight',
  Height: 'height',
  Steps: 'steps',
  SleepSession: 'sleep',
  Hydration: 'water',
};

export const READ_PERMISSIONS: Permission[] = HEALTH_CONNECT_FIELDS.map(field => ({
  accessType: 'read',
  recordType: RECORD_TYPE_BY_FIELD[field],
}));

/**
 * Health Connect answers with the permissions it actually granted, which may
 * include record types we never asked about. Anything unrecognised is dropped
 * rather than guessed at.
 */
export function fieldsFromPermissions(
  permissions: ReadonlyArray<{ accessType: string; recordType: string }>,
): HealthConnectField[] {
  const fields = new Set<HealthConnectField>();
  for (const permission of permissions) {
    if (permission.accessType !== 'read') {
      continue;
    }
    const field = FIELD_BY_RECORD_TYPE[permission.recordType as TrackedRecordType];
    if (field !== undefined) {
      fields.add(field);
    }
  }
  return HEALTH_CONNECT_FIELDS.filter(field => fields.has(field));
}
