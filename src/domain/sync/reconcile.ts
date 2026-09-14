import type { CheckIn } from '@/domain/checkins/types';
import type { PendingOp } from './types';

export type ReconcileArgs = {
  server: readonly CheckIn[];
  ops: readonly PendingOp[];
  serverIds: Readonly<Record<string, string>>;
};

export function reconcileCheckIns({
  server,
  ops,
  serverIds,
}: ReconcileArgs): CheckIn[] {
  const localByServer = new Map<string, string>();
  for (const [localId, serverId] of Object.entries(serverIds)) {
    localByServer.set(serverId, localId);
  }

  const merged = new Map<string, CheckIn>();
  for (const entry of server) {
    const localId = localByServer.get(entry.id) ?? entry.id;
    merged.set(localId, localId === entry.id ? entry : { ...entry, id: localId });
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
