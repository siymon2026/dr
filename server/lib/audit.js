import { db, now, toJson } from './db.js';
import { clientIp } from './security.js';
import { logger } from './logger.js';

const insertAudit = db.prepare(`
  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, meta, ip, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertActivity = db.prepare(`
  INSERT INTO activity_log (user_id, action, meta, ip, created_at) VALUES (?, ?, ?, ?, ?)
`);

/** Administrative / sensitive action trail (append-only). */
export function audit(req, action, { entityType = null, entityId = null, meta = null } = {}) {
  try {
    insertAudit.run(
      req?.user?.id ?? null,
      action,
      entityType,
      entityId,
      toJson(meta),
      req ? clientIp(req) : null,
      now(),
    );
    logger.info({ action, entityType, entityId, actor: req?.user?.id }, 'audit');
  } catch (err) {
    logger.error({ err, action }, 'audit log failed');
  }
}

/** User-facing activity trail shown in the profile/account log. */
export function activity(userId, action, { meta = null, ip = null } = {}) {
  try {
    insertActivity.run(userId, action, toJson(meta), ip, now());
  } catch (err) {
    logger.warn({ err, action }, 'activity log failed');
  }
}
