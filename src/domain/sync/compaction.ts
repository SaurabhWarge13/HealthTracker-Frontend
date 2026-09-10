import type { PendingOp } from './types';

/**
 * Merges a new op into the one already queued for the same check-in.
 *
 * Returns the op to keep, or `null` when the two cancel out entirely.
 * `existing` must not be in flight — an op already on the wire cannot be
 * rewritten, so the caller queues a follow-up instead.
 */
export function mergePendingOp(
  existing: PendingOp | undefined,
  incoming: PendingOp,
): PendingOp | null {
  if (existing === undefined) {
    return incoming;
  }

  /**
   * Created and then deleted before the create was ever sent: nothing to do.
   * Sending a create followed by a delete would be busywork at best.
   *
   * `attempts === 0` is load-bearing. Once a create has been attempted, the
   * server may hold the row even though this device saw a failure — a dropped
   * response is indistinguishable from a dropped request. Cancelling the pair
   * then would strand that row on the server, where it would reappear on the
   * next refetch as a check-in the user already deleted. So the delete is kept
   * and sent; it resolves by `clientId`, and a 404 counts as success.
   */
  if (existing.kind === 'create' && incoming.kind === 'delete') {
    return existing.attempts === 0 ? null : incoming;
  }

  // Edits to something the server has not seen are still a create — with the
  // newest content. Attempts reset because this is new work, not a retry.
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

  // update → update, update → delete, and anything after a delete: the newer
  // intent replaces the older one wholesale.
  return {
    ...incoming,
    // Keep the original queue position by inheriting the op id, so a burst of
    // edits does not jump ahead of ops queued before it.
    opId: existing.opId,
    createdAt: existing.createdAt,
    /**
     * The OLDEST before wins. Four edits offline are one op, and abandoning it
     * has to go back to what the server actually holds — not to the state
     * after the third edit, which the server never saw and which would leave
     * local and server disagreeing.
     */
    before: existing.before,
  };
}

/**
 * Reduces a whole queue so that at most one op per check-in remains.
 *
 * The slice merges on enqueue, so this is the safety net for the one case it
 * cannot: an op that was in flight while another was queued behind it.
 */
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
