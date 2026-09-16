import type { CheckIn } from '@/domain/checkins/types';
import type { PendingOp } from './types';

export type ReconcileArgs = {
  server: readonly CheckIn[];
  ops: readonly PendingOp[];
};

export function reconcileCheckIns({ server, ops }: ReconcileArgs): CheckIn[] {
  // Server rows and pending ops share one id namespace — the client minted it —
  // so they collide in this map by construction and a row cannot appear twice.
  const merged = new Map<string, CheckIn>();
  for (const entry of server) {
    merged.set(entry.id, entry);
  }

  for (const op of ops) {
    if (op.kind === 'delete') {
      merged.delete(op.entityId);
    } else if (op.payload !== null) {
      merged.set(op.entityId, op.payload);
    }
  }

  return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt);
}
