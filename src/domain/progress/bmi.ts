import type { CheckIn } from '@/domain/checkins/types';

export const calculateBmi = (
  weightKg: number,
  heightCm: number,
): number | null => {
  if (heightCm <= 0 || weightKg <= 0) {
    return null;
  }
  const metres = heightCm / 100;
  return weightKg / (metres * metres);
};

export const bmiForCheckIn = (
  checkIn: CheckIn,
  profileHeightCm: number | null,
): number | null => {
  const heightCm = checkIn.heightCm ?? profileHeightCm;
  return heightCm === null ? null : calculateBmi(checkIn.weightKg, heightCm);
};

export const currentBmi = (
  checkIns: readonly CheckIn[],
  profileHeightCm: number | null,
): number | null =>
  checkIns.length === 0 ? null : bmiForCheckIn(checkIns[0], profileHeightCm);
