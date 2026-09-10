import type { CheckIn } from '@/domain/checkins/types';
import type { PendingOp } from './types';

export type ReconcileArgs = {
  /** What `GET /checkins` returned, already mapped to domain shape. */
  server: readonly CheckIn[];
  /** Everything still queued, including failed ops. */
  ops: readonly PendingOp[];
  /** Local id → server id, for check-ins this device created. */
  serverIds: Readonly<Record<string, string>>;
};

export function reconcileCheckIns({
  server,
  ops,
  serverIds,
}: ReconcileArgs): CheckIn[] {
  /**
   * A check-in this device created comes back under the server's id, but the
   * app knows it by the local one. Without this the same entry would appear
   * twice — once as `local_…` and once as its server id.
   */
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
      // Deleted locally; do not let the server's copy resurrect it.
      merged.delete(op.entityId);
    } else if (op.payload !== null) {
      merged.set(op.entityId, op.payload);
    }
  }

  return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt);
}
