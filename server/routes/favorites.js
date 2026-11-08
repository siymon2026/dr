import { Router } from 'express';
import { db, now } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, notFound } from '../lib/errors.js';
import { searchListings } from '../lib/listings.js';
import { limiters } from '../lib/http.js';
import { notify, NOTIFICATION_TYPES } from '../lib/notify.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT l.id FROM favorites f JOIN listings l ON l.id = f.listing_id
         WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT 200`,
      )
      .all(req.user.id);
    const ids = rows.map((r) => r.id);
    if (!ids.length) return res.json({ items: [], total: 0 });
    const result = searchListings({ limit: 200, page: 1 }, { includeNonPublic: true });
    const items = result.items.filter((l) => ids.includes(l.id));
    res.json({ items, total: items.length });
  }),
);

router.post(
  '/:listingId',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(req.params.listingId));
    if (!listing) throw notFound('listing_not_found');
    if (listing.user_id === req.user.id) return res.json({ ok: true, favorite: false });

    const exists = db
      .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND listing_id = ?')
      .get(req.user.id, listing.id);
    if (exists) {
      db.prepare('DELETE FROM favorites WHERE user_id = ? AND listing_id = ?').run(req.user.id, listing.id);
      db.prepare('UPDATE listings SET favorites_count = MAX(0, favorites_count - 1) WHERE id = ?').run(listing.id);
      return res.json({ ok: true, favorite: false, favorites: Math.max(0, listing.favorites_count - 1) });
    }

    db.transaction(() => {
      db.prepare('INSERT INTO favorites (user_id, listing_id, created_at) VALUES (?,?,?)').run(
        req.user.id,
        listing.id,
        now(),
      );
      db.prepare('UPDATE listings SET favorites_count = favorites_count + 1 WHERE id = ?').run(listing.id);
    })();

    notify(listing.user_id, {
      type: NOTIFICATION_TYPES.LISTING_FAVORITED,
      titleKey: 'notif.listing_favorited',
      body: listing.title,
      link: `/listing/${listing.public_id}`,
      data: { listing_id: listing.id },
    });

    res.json({ ok: true, favorite: true, favorites: listing.favorites_count + 1 });
  }),
);

router.get(
  '/ids',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = db.prepare('SELECT listing_id FROM favorites WHERE user_id = ?').all(req.user.id);
    res.json({ ids: rows.map((r) => r.listing_id) });
  }),
);

export default router;
