import { prisma } from '../lib/prisma.js';

/**
 * Write an audit row. Pass a transaction client (`tx`) so the log entry
 * commits or rolls back together with the action it records.
 */
export function audit(tx, { actorId = null, action, entityType, entityId, metadata, ip }) {
  return (tx || prisma).auditLog.create({
    data: { actorId, action, entityType, entityId, metadata, ip },
  });
}
