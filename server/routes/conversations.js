import { Router } from 'express';
import multer from 'multer';
import { db, now } from '../lib/db.js';
import { config } from '../config.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { limiters } from '../lib/http.js';
import { cleanText } from '../lib/security.js';
import { z, validate } from '../lib/validation.js';
import { publish } from '../lib/realtime.js';
import { notify, NOTIFICATION_TYPES } from '../lib/notify.js';
import { processChatImage } from '../lib/storage.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxFileMb * 1024 * 1024, files: 1 },
});

function participantRole(conv, userId) {
  if (conv.buyer_id === userId) return 'buyer';
  if (conv.seller_id === userId) return 'seller';
  return null;
}

function assertParticipant(conv, userId) {
  const role = participantRole(conv, userId);
  if (!role) throw forbidden('not_a_participant');
  return role;
}

function isBlocked(a, b) {
  return !!db.prepare('SELECT 1 FROM blocks WHERE user_id = ? AND blocked_user_id = ?').get(a, b);
}

/** Start (or resume) a conversation about a listing. */
router.post(
  '/',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const { listing_id, message } = validate(
      z.object({
        listing_id: z.coerce.number().int().positive(),
        message: z.string().max(2000).optional(),
      }),
      req.body,
    );

    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listing_id);
    if (!listing || listing.status === 'deleted') throw notFound('listing_not_found');
    if (listing.user_id === req.user.id) throw conflict('cannot_message_yourself');
    if (isBlocked(listing.user_id, req.user.id)) throw forbidden('user_blocked_you');
    if (isBlocked(req.user.id, listing.user_id)) throw forbidden('you_blocked_user');

    const seller = db.prepare('SELECT id, allow_messages, status FROM users WHERE id = ?').get(listing.user_id);
    if (!seller || seller.status !== 'active') throw forbidden('seller_unavailable');
    if (!seller.allow_messages) throw forbidden('seller_not_accepting_messages');

    let conv = db
      .prepare('SELECT * FROM conversations WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?')
      .get(listing_id, req.user.id, listing.user_id);

    const ts = now();
    if (!conv) {
      const info = db
        .prepare(
          `INSERT INTO conversations (listing_id, buyer_id, seller_id, last_message_at, created_at)
           VALUES (?,?,?,?,?)`,
        )
        .run(listing_id, req.user.id, listing.user_id, ts, ts);
      conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
    }

    const body = message ? cleanText(message, { maxLength: 2000 }) : '';
    if (body) {
      insertMessage(conv, req.user.id, body, null);
    }
    res.status(201).json({ conversation: mapConversation(conv.id, req.user.id) });
  }),
);

function insertMessage(conv, senderId, body, attachment) {
  const ts = now();
  const role = participantRole(conv, senderId);
  const preview = attachment ? '📎' : body.slice(0, 120);
  const info = db.transaction(() => {
    const r = db
      .prepare('INSERT INTO messages (conversation_id, sender_id, body, attachment, created_at) VALUES (?,?,?,?,?)')
      .run(conv.id, senderId, body || null, attachment || null, ts);
    db.prepare(
      `UPDATE conversations SET last_message_at = ?, last_message = ?,
         buyer_unread = buyer_unread + CASE WHEN ? = seller_id THEN 1 ELSE 0 END,
         seller_unread = seller_unread + CASE WHEN ? = buyer_id THEN 1 ELSE 0 END,
         buyer_archived = CASE WHEN ? = seller_id THEN 0 ELSE buyer_archived END,
         seller_archived = CASE WHEN ? = buyer_id THEN 0 ELSE seller_archived END
       WHERE id = ?`,
    ).run(ts, preview, senderId, senderId, senderId, senderId, conv.id);
    return r;
  })();

  const message = {
    id: Number(info.lastInsertRowid),
    conversation_id: conv.id,
    sender_id: senderId,
    body: body || null,
    attachment: attachment || null,
    created_at: ts,
    read_at: null,
  };

  const recipient = role === 'buyer' ? conv.seller_id : conv.buyer_id;
  publish(recipient, 'message', { ...message, role: 'incoming' });
  publish(senderId, 'message', { ...message, role: 'outgoing' });

  const unread = role === 'buyer' ? 'seller_unread' : 'buyer_unread';
  const current = db.prepare(`SELECT ${unread} AS n FROM conversations WHERE id = ?`).get(conv.id);
  publish(recipient, 'conversation', { conversation_id: conv.id, unread: current.n });

  notify(recipient, {
    type: NOTIFICATION_TYPES.MESSAGE,
    titleKey: 'notif.new_message',
    body: body ? body.slice(0, 90) : '📷',
    link: `/messages/${conv.id}`,
    data: { conversation_id: conv.id },
  });

  return message;
}

function mapConversation(id, userId) {
  const row = db
    .prepare(
      `SELECT cv.*, l.public_id AS listing_public_id, l.title AS listing_title, l.price_cents, l.currency, l.status AS listing_status,
              (SELECT path FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, position LIMIT 1) AS listing_image,
              b.name AS buyer_name, b.avatar AS buyer_avatar, s.name AS seller_name, s.avatar AS seller_avatar
       FROM conversations cv
       JOIN listings l ON l.id = cv.listing_id
       JOIN users b ON b.id = cv.buyer_id
       JOIN users s ON s.id = cv.seller_id
       WHERE cv.id = ?`,
    )
    .get(id);
  if (!row) return null;
  const role = row.buyer_id === userId ? 'buyer' : 'seller';
  return {
    id: row.id,
    role,
    listing: {
      id: row.listing_id,
      public_id: row.listing_public_id,
      title: row.listing_title,
      price: row.price_cents / 100,
      currency: row.currency,
      image: row.listing_image,
      status: row.listing_status,
    },
    counterpart:
      role === 'buyer'
        ? { id: row.seller_id, name: row.seller_name, avatar: row.seller_avatar }
        : { id: row.buyer_id, name: row.buyer_name, avatar: row.buyer_avatar },
    last_message: row.last_message,
    last_message_at: row.last_message_at,
    unread: role === 'buyer' ? row.buyer_unread : row.seller_unread,
    archived: !!(role === 'buyer' ? row.buyer_archived : row.seller_archived),
    created_at: row.created_at,
  };
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT id FROM conversations WHERE buyer_id = @uid OR seller_id = @uid
         ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT 100`,
      )
      .all({ uid: req.user.id });
    const items = rows.map((r) => mapConversation(r.id, req.user.id)).filter(Boolean);
    const totalUnread = items.reduce((sum, c) => sum + c.unread, 0);
    res.json({ items, total_unread: totalUnread });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(req.params.id));
    if (!conv) throw notFound('conversation_not_found');
    const role = assertParticipant(conv, req.user.id);

    const before = Number(req.query.before) || null;
    const rows = db
      .prepare(
        `SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar
         FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = ? ${before ? 'AND m.id < ?' : ''}
         ORDER BY m.id DESC LIMIT 50`,
      )
      .all(...(before ? [conv.id, before] : [conv.id]));

    // mark as read
    db.prepare(`UPDATE conversations SET ${role === 'buyer' ? 'buyer_unread' : 'seller_unread'} = 0 WHERE id = ?`).run(
      conv.id,
    );
    db.prepare('UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL').run(
      now(),
      conv.id,
      req.user.id,
    );
    publish(role === 'buyer' ? conv.seller_id : conv.buyer_id, 'read', { conversation_id: conv.id });

    const blocked = isBlocked(req.user.id, role === 'buyer' ? conv.seller_id : conv.buyer_id);
    res.json({
      conversation: mapConversation(conv.id, req.user.id),
      messages: rows.reverse(),
      has_more: rows.length === 50,
      blocked_by_me: blocked,
    });
  }),
);

router.post(
  '/:id/messages',
  requireAuth,
  limiters.message,
  asyncHandler(async (req, res) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(req.params.id));
    if (!conv) throw notFound('conversation_not_found');
    assertParticipant(conv, req.user.id);

    const { body } = validate(z.object({ body: z.string().min(1).max(2000) }), req.body);
    const text = cleanText(body, { maxLength: 2000 });
    if (!text) throw badRequest('empty_message');

    const counterpart = conv.buyer_id === req.user.id ? conv.seller_id : conv.buyer_id;
    if (isBlocked(req.user.id, counterpart)) throw forbidden('you_blocked_user');
    if (isBlocked(counterpart, req.user.id)) throw forbidden('user_blocked_you');

    // Simple burst protection per conversation.
    const recent = db
      .prepare('SELECT COUNT(*) c FROM messages WHERE conversation_id = ? AND sender_id = ? AND created_at > ?')
      .get(conv.id, req.user.id, now() - 10_000).c;
    if (recent >= 8) throw conflict('slow_down');

    const message = insertMessage(conv, req.user.id, text, null);
    res.status(201).json({ message });
  }),
);

router.post(
  '/:id/image',
  requireAuth,
  limiters.upload,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(req.params.id));
    if (!conv) throw notFound('conversation_not_found');
    assertParticipant(conv, req.user.id);
    if (!req.file) throw badRequest('no_file');
    const path = await processChatImage(req.file, req.user.id);
    const message = insertMessage(conv, req.user.id, '', path);
    res.status(201).json({ message });
  }),
);

router.post(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(req.params.id));
    if (!conv) throw notFound('conversation_not_found');
    const role = assertParticipant(conv, req.user.id);
    db.prepare(`UPDATE conversations SET ${role === 'buyer' ? 'buyer_unread' : 'seller_unread'} = 0 WHERE id = ?`).run(
      conv.id,
    );
    res.json({ ok: true });
  }),
);

router.post(
  '/:id/archive',
  requireAuth,
  asyncHandler(async (req, res) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(req.params.id));
    if (!conv) throw notFound('conversation_not_found');
    const role = assertParticipant(conv, req.user.id);
    const col = role === 'buyer' ? 'buyer_archived' : 'seller_archived';
    db.prepare(`UPDATE conversations SET ${col} = 1 - ${col} WHERE id = ?`).run(conv.id);
    res.json({ ok: true });
  }),
);

/* ------------------------------ blocking ------------------------------ */
router.post(
  '/block/:userId',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const target = Number(req.params.userId);
    if (target === req.user.id) throw badRequest('cannot_block_self');
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(target)) throw notFound('user_not_found');
    db.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_user_id, created_at) VALUES (?,?,?)').run(
      req.user.id,
      target,
      now(),
    );
    res.json({ ok: true, blocked: true });
  }),
);

router.delete(
  '/block/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked_user_id = ?').run(req.user.id, Number(req.params.userId));
    res.json({ ok: true, blocked: false });
  }),
);

router.get(
  '/blocks/list',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.avatar, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_user_id
         WHERE b.user_id = ? ORDER BY b.created_at DESC`,
      )
      .all(req.user.id);
    res.json({ items: rows });
  }),
);

export default router;
