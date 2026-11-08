import { Router } from 'express';
import { db, now } from '../lib/db.js';
import { z, validate, text } from '../lib/validation.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { limiters } from '../lib/http.js';
import { slugify } from '../lib/security.js';
import { searchListings } from '../lib/listings.js';
import { audit, activity } from '../lib/audit.js';
import { notify, NOTIFICATION_TYPES } from '../lib/notify.js';

const router = Router();

function uniqueSlug(base) {
  let slug = slugify(base);
  let i = 1;
  while (db.prepare('SELECT 1 FROM stores WHERE slug = ?').get(slug)) {
    slug = `${slugify(base)}-${i}`;
    i += 1;
    if (i > 50) slug = `${slugify(base)}-${Date.now()}`;
  }
  return slug;
}

function mapStore(row, { owner = false } = {}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo: row.logo,
    cover: row.cover,
    description: row.description,
    status: row.status,
    status_reason: owner ? row.status_reason : undefined,
    verified: !!row.verified,
    featured: !!row.featured,
    phone: row.phone,
    whatsapp: row.whatsapp,
    website: row.website,
    city: row.city_id
      ? { id: row.city_id, name: { ar: row.city_ar, fr: row.city_fr, en: row.city_en }, slug: row.city_slug }
      : null,
    followers: row.followers_count,
    rating_avg: row.rating_avg,
    rating_count: row.rating_count,
    views: row.views_count,
    sales: row.sales_count,
    listings_count: row.listings_count ?? undefined,
    owner: owner || row.owner_name ? { id: row.user_id, name: row.owner_name, avatar: row.owner_avatar } : undefined,
    created_at: row.created_at,
  };
}

const storeSelect = `
  SELECT s.*, ci.name_ar AS city_ar, ci.name_fr AS city_fr, ci.name_en AS city_en, ci.slug AS city_slug,
         u.name AS owner_name, u.avatar AS owner_avatar,
         (SELECT COUNT(*) FROM listings l WHERE l.store_id = s.id AND l.status='active') AS listings_count
  FROM stores s
  LEFT JOIN cities ci ON ci.id = s.city_id
  LEFT JOIN users u ON u.id = s.user_id
`;

/* ------------------------------ public ------------------------------ */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(48, Number(req.query.limit) || 24);
    const page = Math.max(1, Number(req.query.page) || 1);
    const where = ["s.status = 'active'"];
    const params = { limit, offset: (page - 1) * limit };
    if (req.query.city) {
      where.push('s.city_id = @city');
      params.city = Number(req.query.city);
    }
    if (req.query.q) {
      where.push('(s.name LIKE @q OR s.description LIKE @q)');
      params.q = `%${String(req.query.q).slice(0, 50)}%`;
    }
    const rows = db
      .prepare(`${storeSelect} WHERE ${where.join(' AND ')} ORDER BY s.featured DESC, s.followers_count DESC LIMIT @limit OFFSET @offset`)
      .all(params);
    const total = db.prepare(`SELECT COUNT(*) c FROM stores s WHERE ${where.join(' AND ')}`).get(params).c;
    res.json({ items: rows.map((r) => mapStore(r)), pagination: { page, limit, total } });
  }),
);

router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = db.prepare(`${storeSelect} WHERE s.user_id = ?`).get(req.user.id);
    if (!row) return res.json({ store: null });
    const reviews = db
      .prepare(
        `SELECT r.rating, r.comment, r.created_at, u.name AS reviewer_name FROM reviews r
         JOIN users u ON u.id = r.reviewer_id
         WHERE r.target_type='store' AND r.target_id=? AND r.status='visible' ORDER BY r.created_at DESC LIMIT 10`,
      )
      .all(row.id);
    res.json({ store: mapStore(row, { owner: true }), reviews });
  }),
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const row = db.prepare(`${storeSelect} WHERE s.slug = ?`).get(req.params.slug);
    if (!row) throw notFound('store_not_found');
    if (row.status !== 'active' && req.user?.id !== row.user_id && !['admin', 'superadmin', 'moderator'].includes(req.user?.role)) {
      throw notFound('store_not_found');
    }
    const listings = searchListings({ store: row.id, limit: 24, sort: req.query.sort || 'newest' });
    const reviews = db
      .prepare(
        `SELECT r.rating, r.comment, r.created_at, r.verified, u.name AS reviewer_name, u.avatar AS reviewer_avatar
         FROM reviews r JOIN users u ON u.id = r.reviewer_id
         WHERE r.target_type='store' AND r.target_id=? AND r.status='visible'
         ORDER BY r.created_at DESC LIMIT 20`,
      )
      .all(row.id);
    const following = req.user
      ? !!db.prepare('SELECT 1 FROM store_followers WHERE store_id = ? AND user_id = ?').get(row.id, req.user.id)
      : false;
    res.json({ store: mapStore(row, { owner: req.user?.id === row.user_id }), listings, reviews, following });
  }),
);

/* ------------------------------ create / update ------------------------------ */

const storeSchema = z.object({
  name: text(3, 80),
  description: text(20, 2000),
  city_id: z.coerce.number().int().positive(),
  phone: z.string().max(20).nullable().optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  website: z.string().url().max(200).nullable().optional(),
  logo: z.string().max(300).nullable().optional(),
  cover: z.string().max(300).nullable().optional(),
});

router.post(
  '/',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const data = validate(storeSchema, req.body);
    if (db.prepare('SELECT 1 FROM stores WHERE user_id = ?').get(req.user.id)) {
      throw conflict('store_already_exists');
    }
    if (!db.prepare('SELECT 1 FROM cities WHERE id = ?').get(data.city_id)) throw badRequest('invalid_city');
    if (data.whatsapp && !/^[+\d\s-]{9,20}$/.test(data.whatsapp)) throw badRequest('invalid_whatsapp');

    const ts = now();
    const info = db
      .prepare(
        `INSERT INTO stores (user_id, name, slug, logo, cover, description, city_id, phone, whatsapp, website,
                             status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?)`,
      )
      .run(
        req.user.id,
        data.name,
        uniqueSlug(data.name),
        data.logo || null,
        data.cover || null,
        data.description,
        data.city_id,
        data.phone || null,
        data.whatsapp || null,
        data.website || null,
        ts,
        ts,
      );
    db.prepare('UPDATE users SET is_store = 1, updated_at = ? WHERE id = ?').run(ts, req.user.id);
    activity(req.user.id, 'store.created', { ip: req.ip });
    res.status(201).json({ store_id: Number(info.lastInsertRowid), status: 'pending' });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(Number(req.params.id));
    if (!store) throw notFound('store_not_found');
    const isStaff = ['admin', 'superadmin'].includes(req.user.role);
    if (store.user_id !== req.user.id && !isStaff) throw forbidden();

    const data = validate(storeSchema.partial(), req.body);
    const fields = [];
    const values = [];
    for (const key of ['name', 'description', 'city_id', 'phone', 'whatsapp', 'website', 'logo', 'cover']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (!fields.length) throw badRequest('nothing_to_update');

    // Owner edits to the public profile re-enter moderation.
    if (!isStaff && store.status === 'active' && (data.name || data.description)) {
      fields.push("status = 'pending'");
    }
    fields.push('updated_at = ?');
    values.push(now(), store.id);
    db.prepare(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    if (isStaff) audit(req, 'store.edited', { entityType: 'store', entityId: store.id });
    res.json({ ok: true });
  }),
);

router.post(
  '/:id/follow',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(Number(req.params.id));
    if (!store || store.status !== 'active') throw notFound('store_not_found');
    if (store.user_id === req.user.id) throw badRequest('cannot_follow_own_store');

    const exists = db
      .prepare('SELECT 1 FROM store_followers WHERE store_id = ? AND user_id = ?')
      .get(store.id, req.user.id);
    db.transaction(() => {
      if (exists) {
        db.prepare('DELETE FROM store_followers WHERE store_id = ? AND user_id = ?').run(store.id, req.user.id);
        db.prepare('UPDATE stores SET followers_count = MAX(0, followers_count - 1) WHERE id = ?').run(store.id);
      } else {
        db.prepare('INSERT INTO store_followers (store_id, user_id, created_at) VALUES (?,?,?)').run(
          store.id,
          req.user.id,
          now(),
        );
        db.prepare('UPDATE stores SET followers_count = followers_count + 1 WHERE id = ?').run(store.id);
      }
    })();
    const fresh = db.prepare('SELECT followers_count FROM stores WHERE id = ?').get(store.id);
    res.json({ ok: true, following: !exists, followers: fresh.followers_count });
  }),
);

export default router;
