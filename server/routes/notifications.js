import { Router } from 'express';
import { db, now } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler } from '../lib/errors.js';
import { subscribe } from '../lib/realtime.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(60, Number(req.query.limit) || 30);
    const rows = db
      .prepare(
        `SELECT id, type, title_key, body, link, data, read_at, created_at FROM notifications
         WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(req.user.id, limit);
    const unread = db
      .prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read_at IS NULL')
      .get(req.user.id).c;
    res.json({ items: rows, unread });
  }),
);

router.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req, res) => {
    const unread = db
      .prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read_at IS NULL')
      .get(req.user.id).c;
    const messages = db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN buyer_id = @uid THEN buyer_unread ELSE seller_unread END), 0) c
         FROM conversations WHERE buyer_id = @uid OR seller_id = @uid`,
      )
      .get({ uid: req.user.id }).c;
    res.json({ notifications: unread, messages });
  }),
);

router.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now(), req.user.id);
    res.json({ ok: true });
  }),
);

router.post(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?').run(
      now(),
      Number(req.params.id),
      req.user.id,
    );
    res.json({ ok: true });
  }),
);

/** Server-Sent Events stream — the client receives messages & notifications in real time. */
router.get('/stream', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: ready\ndata: {"user_id":${req.user.id}}\n\n`);
  const unsubscribe = subscribe(req.user.id, res);
  const close = () => {
    unsubscribe();
    try {
      res.end();
    } catch {
      /* ignore */
    }
  };
  req.on('close', close);
  req.on('error', close);
});

export default router;
