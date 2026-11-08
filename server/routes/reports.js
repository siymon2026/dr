import { Router } from 'express';
import { db, now } from '../lib/db.js';
import { z, validate, text } from '../lib/validation.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, badRequest } from '../lib/errors.js';
import { limiters } from '../lib/http.js';
import { notify, NOTIFICATION_TYPES } from '../lib/notify.js';

const router = Router();

export const REPORT_REASONS = [
  'prohibited_item',
  'scam',
  'wrong_category',
  'counterfeit',
  'offensive',
  'duplicate',
  'spam',
  'other',
];

const reportSchema = z.object({
  target_type: z.enum(['listing', 'user', 'store', 'message']),
  target_id: z.coerce.number().int().positive(),
  reason: z.enum(REPORT_REASONS),
  details: text(0, 1000).optional(),
});

router.post(
  '/',
  requireAuth,
  limiters.report,
  asyncHandler(async (req, res) => {
    const data = validate(reportSchema, req.body);
    const exists =
      data.target_type === 'listing'
        ? db.prepare('SELECT 1 FROM listings WHERE id = ?').get(data.target_id)
        : data.target_type === 'user'
          ? db.prepare('SELECT 1 FROM users WHERE id = ?').get(data.target_id)
          : data.target_type === 'store'
            ? db.prepare('SELECT 1 FROM stores WHERE id = ?').get(data.target_id)
            : db.prepare('SELECT 1 FROM messages WHERE id = ?').get(data.target_id);
    if (!exists) throw badRequest('invalid_target');

    const dup = db
      .prepare(
        `SELECT 1 FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND created_at > ?`,
      )
      .get(req.user.id, data.target_type, data.target_id, now() - 864e5);
    if (dup) throw badRequest('already_reported');

    const ts = now();
    db.prepare(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, details, status, created_at, updated_at)
       VALUES (?,?,?,?,?,'open',?,?)`,
    ).run(req.user.id, data.target_type, data.target_id, data.reason, data.details || null, ts, ts);

    res.status(201).json({ ok: true, message: 'report_received' });
  }),
);

router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        'SELECT id, target_type, target_id, reason, status, resolution_note, created_at FROM reports WHERE reporter_id = ? ORDER BY created_at DESC LIMIT 50',
      )
      .all(req.user.id);
    res.json({ items: rows });
  }),
);

export default router;
