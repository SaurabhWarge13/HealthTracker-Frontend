export const createId = (): string => {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `local_${time}_${random}`;
};

export const isLocalId = (id: string): boolean => id.startsWith('local_');
