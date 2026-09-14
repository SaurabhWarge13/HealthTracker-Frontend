import type { PendingOp } from './types';

export function mergePendingOp(
  existing: PendingOp | undefined,
  incoming: PendingOp,
): PendingOp | null {
  if (existing === undefined) {
    return incoming;
  }

  if (existing.kind === 'create' && incoming.kind === 'delete') {
    return existing.attempts === 0 ? null : incoming;
  }

  if (existing.kind === 'create' && incoming.kind === 'update') {
    return {
      ...existing,
      payload: incoming.payload,
      attempts: 0,
      nextAttemptAt: incoming.createdAt,
      failed: false,
      lastError: null,
    };
  }

  return {
    ...incoming,
    opId: existing.opId,
    createdAt: existing.createdAt,
    before: existing.before,
  };
}

export function compactOps(ops: readonly PendingOp[]): PendingOp[] {
  const byEntity = new Map<string, PendingOp>();
  const order: string[] = [];

  for (const op of ops) {
    const existing = byEntity.get(op.entityId);
    if (existing === undefined) {
      order.push(op.entityId);
    }
    const merged = mergePendingOp(existing, op);
    if (merged === null) {
      byEntity.delete(op.entityId);
      const index = order.indexOf(op.entityId);
      if (index !== -1) {
        order.splice(index, 1);
      }
    } else {
      byEntity.set(op.entityId, merged);
    }
  }

  return order
    .map(entityId => byEntity.get(entityId))
    .filter((op): op is PendingOp => op !== undefined);
}
