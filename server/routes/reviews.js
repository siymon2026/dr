import { Router } from 'express';
import { db, now } from '../lib/db.js';
import { z, validate, text } from '../lib/validation.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { limiters } from '../lib/http.js';
import { notify, NOTIFICATION_TYPES } from '../lib/notify.js';
import { audit } from '../lib/audit.js';

const router = Router();

/**
 * Anti-abuse: a review is only accepted if the reviewer had a real conversation
 * about one of the target's listings, and each reviewer may review a target once.
 * Reviews tied to a conversation are marked `verified`.
 */
function hasTransaction(reviewerId, targetType, targetId) {
  if (targetType === 'user') {
    return db
      .prepare(
        `SELECT cv.id FROM conversations cv JOIN listings l ON l.id = cv.listing_id
         WHERE ((cv.buyer_id = ? AND cv.seller_id = ?) OR (cv.seller_id = ? AND cv.buyer_id = ?))
           AND (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = cv.id AND m.sender_id != ?) > 0
         LIMIT 1`,
      )
      .get(reviewerId, targetId, reviewerId, targetId, reviewerId);
  }
  return db
    .prepare(
      `SELECT cv.id FROM conversations cv JOIN listings l ON l.id = cv.listing_id
       JOIN stores s ON s.id = l.store_id
       WHERE s.id = ? AND cv.buyer_id = ?
         AND (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = cv.id AND m.sender_id != ?) > 0
       LIMIT 1`,
    )
    .get(targetId, reviewerId, reviewerId);
}

function recompute(targetType, targetId) {
  const agg = db
    .prepare(
      `SELECT COUNT(*) c, COALESCE(AVG(rating), 0) a FROM reviews
       WHERE target_type = ? AND target_id = ? AND status = 'visible'`,
    )
    .get(targetType, targetId);
  if (targetType === 'user') {
    db.prepare('UPDATE users SET rating_avg = ?, rating_count = ? WHERE id = ?').run(agg.a, agg.c, targetId);
  } else {
    db.prepare('UPDATE stores SET rating_avg = ?, rating_count = ? WHERE id = ?').run(agg.a, agg.c, targetId);
  }
}

const reviewSchema = z.object({
  target_type: z.enum(['user', 'store']),
  target_id: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: text(0, 800).optional(),
});

router.post(
  '/',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const data = validate(reviewSchema, req.body);

    if (data.target_type === 'user' && data.target_id === req.user.id) throw badRequest('cannot_review_self');
    const targetExists =
      data.target_type === 'user'
        ? db.prepare('SELECT 1 FROM users WHERE id = ?').get(data.target_id)
        : db.prepare('SELECT 1 FROM stores WHERE id = ?').get(data.target_id);
    if (!targetExists) throw notFound('target_not_found');

    const existing = db
      .prepare('SELECT * FROM reviews WHERE target_type = ? AND target_id = ? AND reviewer_id = ?')
      .get(data.target_type, data.target_id, req.user.id);
    if (existing) throw conflict('already_reviewed');

    const verified = !!hasTransaction(req.user.id, data.target_type, data.target_id);
    if (!verified) throw forbidden('review_requires_interaction');

    const ts = now();
    db.prepare(
      `INSERT INTO reviews (target_type, target_id, reviewer_id, rating, comment, verified, status, created_at, updated_at)
       VALUES (?,?,?,?,?,1,'visible',?,?)`,
    ).run(data.target_type, data.target_id, req.user.id, data.rating, data.comment || null, ts, ts);
    recompute(data.target_type, data.target_id);

    const recipientId =
      data.target_type === 'user'
        ? data.target_id
        : db.prepare('SELECT user_id FROM stores WHERE id = ?').get(data.target_id)?.user_id;
    if (recipientId) {
      notify(recipientId, {
        type: NOTIFICATION_TYPES.REVIEW_RECEIVED,
        titleKey: 'notif.review_received',
        body: `${data.rating}★`,
        link: data.target_type === 'store' ? `/stores/${data.target_id}` : `/users/${recipientId}`,
      });
    }
    res.status(201).json({ ok: true, verified });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { target_type, target_id } = req.query;
    if (!['user', 'store'].includes(target_type) || !target_id) throw badRequest('target_required');
    const rows = db
      .prepare(
        `SELECT r.id, r.rating, r.comment, r.created_at, r.verified, u.name AS reviewer_name, u.avatar AS reviewer_avatar
         FROM reviews r JOIN users u ON u.id = r.reviewer_id
         WHERE r.target_type = ? AND r.target_id = ? AND r.status = 'visible'
         ORDER BY r.created_at DESC LIMIT 50`,
      )
      .all(String(target_type), Number(target_id));
    res.json({ items: rows });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(Number(req.params.id));
    if (!review) throw notFound('review_not_found');
    const isStaff = ['admin', 'superadmin', 'moderator'].includes(req.user.role);
    if (review.reviewer_id !== req.user.id && !isStaff) throw forbidden();

    if (isStaff && review.reviewer_id !== req.user.id) {
      db.prepare("UPDATE reviews SET status='hidden', updated_at=? WHERE id=?").run(now(), review.id);
      audit(req, 'review.hidden', { entityType: 'review', entityId: review.id });
    } else {
      db.prepare('DELETE FROM reviews WHERE id = ?').run(review.id);
    }
    recompute(review.target_type, review.target_id);
    res.json({ ok: true });
  }),
);

export default router;
