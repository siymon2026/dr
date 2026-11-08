import { Router } from 'express';
import { db, now } from '../lib/db.js';
import { z, validate, text, booleanish } from '../lib/validation.js';
import { badRequest, conflict, forbidden, notFound, asyncHandler } from '../lib/errors.js';
import { requireAuth } from '../lib/auth.js';
import { limiters } from '../lib/http.js';
import { clientIp, randomToken } from '../lib/security.js';
import {
  searchListings,
  getListing,
  mapListingRow,
  listingImages,
  assertCanManage,
  moderationScan,
  createListingRecord,
  republishListing,
  incrementView,
  quotaFor,
  CONDITIONS,
  LISTING_TTL_DAYS,
} from '../lib/listings.js';
import { audit } from '../lib/audit.js';
import { notify, NOTIFICATION_TYPES } from '../lib/notify.js';
import { removeListingImageFiles } from '../lib/storage.js';

const router = Router();

const attributesSchema = z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional();

const listingSchema = z.object({
  title: text(6, 110),
  description: text(20, 4000),
  category_id: z.coerce.number().int().positive(),
  price_cents: z.coerce.number().int().min(0).max(100_000_000),
  negotiable: z.boolean().default(false),
  condition: z.enum(CONDITIONS),
  city_id: z.coerce.number().int().positive(),
  area_id: z.coerce.number().int().positive().nullable().optional(),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  contact_phone: z.string().max(20).nullable().optional(),
  attributes: attributesSchema,
});

function validateTaxonomy(data) {
  const cat = db.prepare('SELECT id, active, parent_id FROM categories WHERE id = ?').get(data.category_id);
  if (!cat || !cat.active) throw badRequest('invalid_category');
  if (cat.parent_id) {
    const parent = db.prepare('SELECT active FROM categories WHERE id = ?').get(cat.parent_id);
    if (!parent?.active) throw badRequest('invalid_category');
  }
  if (!db.prepare('SELECT 1 FROM cities WHERE id = ? AND active = 1').get(data.city_id)) {
    throw badRequest('invalid_city');
  }
  if (data.area_id) {
    const area = db.prepare('SELECT city_id, active FROM areas WHERE id = ?').get(data.area_id);
    if (!area || !area.active || area.city_id !== data.city_id) throw badRequest('invalid_area');
  }
}

function hasStore(userId) {
  return db.prepare("SELECT id FROM stores WHERE user_id = ? AND status = 'active'").get(userId)?.id ?? null;
}

/* ------------------------------- browse ------------------------------- */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = searchListings(req.query);
    if (req.query.q && String(req.query.q).trim().length >= 2) {
      db.prepare('INSERT INTO search_queries (query, results, user_id, created_at) VALUES (?,?,?,?)').run(
        String(req.query.q).trim().slice(0, 80),
        result.pagination.total,
        req.user?.id ?? null,
        now(),
      );
    }
    res.json(result);
  }),
);

router.get(
  '/home',
  asyncHandler(async (req, res) => {
    const base = { limit: 12, sort: 'relevance' };
    const [latest, featured, popular, recent, deals, stores] = [
      searchListings({ ...base, sort: 'newest' }),
      searchListings({ ...base, featured: '1' }),
      searchListings({ ...base, sort: 'views' }),
      searchListings({ ...base, sort: 'newest', limit: 8 }),
      searchListings({ ...base, max_price: '500', sort: 'newest' }),
      db
        .prepare(
          `SELECT s.id, s.name, s.slug, s.logo, s.verified, s.followers_count, s.rating_avg, s.rating_count,
                  (SELECT COUNT(*) FROM listings WHERE store_id = s.id AND status = 'active') AS listings_count,
                  ci.name_ar AS city_ar, ci.name_fr AS city_fr, ci.name_en AS city_en
           FROM stores s LEFT JOIN cities ci ON ci.id = s.city_id
           WHERE s.status = 'active' ORDER BY s.featured DESC, s.followers_count DESC LIMIT 8`,
        )
        .all(),
    ];
    const stats = {
      listings: db.prepare("SELECT COUNT(*) c FROM listings WHERE status='active'").get().c,
      users: db.prepare("SELECT COUNT(*) c FROM users WHERE status='active'").get().c,
      stores: db.prepare("SELECT COUNT(*) c FROM stores WHERE status='active'").get().c,
      cities: db.prepare('SELECT COUNT(*) c FROM cities WHERE active=1').get().c,
    };
    res.json({
      latest: latest.items,
      featured: featured.items,
      popular: popular.items,
      recent: recent.items,
      deals: deals.items,
      stores,
      stats,
    });
  }),
);

router.get(
  '/nearby',
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius) || 40;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest('coordinates_required');
    const result = searchListings({ lat, lng, radius, limit: req.query.limit || 12 });
    res.json(result);
  }),
);

router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || 'all');
    const params = { userId: req.user.id };
    let where = 'l.user_id = @userId';
    if (status !== 'all') {
      where += ' AND l.status = @status';
      params.status = status;
    }
    const rows = db
      .prepare(
        `SELECT l.*, c.name_ar AS category_ar, c.name_fr AS category_fr, c.name_en AS category_en, c.slug AS category_slug,
                c.name_ar AS cat_ar, c.name_fr AS cat_fr, c.name_en AS cat_en, c.slug AS cat_slug, c.id AS cat_id,
                ci.name_ar AS city_ar, ci.name_fr AS city_fr, ci.name_en AS city_en, ci.slug AS city_slug,
                (SELECT path FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, position LIMIT 1) AS image,
                (SELECT COUNT(*) FROM listing_images WHERE listing_id = l.id) AS images_count
         FROM listings l
         JOIN categories c ON c.id = l.category_id
         JOIN cities ci ON ci.id = l.city_id
         WHERE ${where}
         ORDER BY l.created_at DESC LIMIT 200`,
      )
      .all(params);

    const counts = db
      .prepare('SELECT status, COUNT(*) c FROM listings WHERE user_id = ? GROUP BY status')
      .all(req.user.id);
    res.json({
      items: rows.map((r) => ({
        ...mapListingRow(r, { withOwner: false }),
        title: r.title,
        description: r.description,
        rejection_reason: r.rejection_reason,
        images_count: r.images_count,
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c.c])),
      quota: quotaFor(req.user.id),
    });
  }),
);

/* ------------------------------- detail ------------------------------- */

router.get(
  '/:idOrPublicId',
  asyncHandler(async (req, res) => {
    const key = req.params.idOrPublicId;
    let listing;
    try {
      listing = getListing(key);
    } catch (err) {
      // Owners and staff may preview non-active listings.
      listing = getListing(key, { includeNonPublic: true });
      const canView =
        req.user &&
        (req.user.id === listing.user_id || ['admin', 'superadmin', 'moderator'].includes(req.user.role));
      if (!canView) throw notFound('listing_not_found');
    }

    const images = listingImages(listing.id);
    const isOwner = req.user?.id === listing.user_id;
    const isStaffViewer = req.user && ['admin', 'superadmin', 'moderator'].includes(req.user.role);

    if (!isOwner) {
      incrementView(listing, { userId: req.user?.id ?? null, visitorKey: req.user ? `u${req.user.id}` : clientIp(req) });
    }

    const isFavorite = req.user
      ? !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND listing_id = ?').get(req.user.id, listing.id)
      : false;

    const similar = searchListings({
      category: listing.category_id,
      city: listing.city_id,
      limit: 8,
    }).items.filter((l) => l.id !== listing.id);

    const phone = listing.contact_phone || null;
    const contactPhone =
      isOwner || isStaffViewer || listing.owner_show_phone
        ? phone
        : req.user
          ? null
          : null;

    res.json({
      listing: {
        ...mapListingRow(listing),
        description: listing.description,
        attributes: listing.attributes ? JSON.parse(listing.attributes) : {},
        rejection_reason: isOwner || isStaffViewer ? listing.rejection_reason : undefined,
        images,
        contact_phone: contactPhone,
      },
      owner: {
        id: listing.user_id,
        name: listing.owner_name,
        avatar: listing.owner_avatar,
        verified: !!listing.owner_verified,
        rating_avg: listing.owner_rating,
        rating_count: listing.owner_rating_count,
        is_store: !!listing.owner_is_store,
        member_since: listing.owner_created,
        last_seen_at: req.user ? listing.owner_last_seen : null,
        phone: contactPhone,
      },
      store: listing.store_name
        ? {
            id: listing.store_id,
            name: listing.store_name,
            slug: listing.store_slug,
            logo: listing.store_logo,
            verified: !!listing.store_verified,
            rating_avg: listing.store_rating,
            followers: listing.store_followers,
          }
        : null,
      is_favorite: isFavorite,
      is_owner: isOwner,
      similar,
    });
  }),
);

/* ------------------------------- create ------------------------------- */

router.get(
  '/quota/me',
  requireAuth,
  asyncHandler(async (req, res) => res.json(quotaFor(req.user.id))),
);

router.post(
  '/',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const data = validate(listingSchema, req.body);
    moderationScan(data);
    validateTaxonomy(data);

    const quota = quotaFor(req.user.id);
    if (quota.remaining <= 0) {
      throw forbidden('listing_quota_exceeded');
    }
    if (req.user.status !== 'active') throw forbidden('account_disabled');

    const storeId = hasStore(req.user.id);
    const { id, publicId, status } = createListingRecord(req.user, { ...data, store_id: storeId });
    res.status(201).json({ id, public_id: publicId, status });
  }),
);

/* ------------------------------- update ------------------------------- */

router.patch(
  '/:id',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(req.params.id));
    if (!listing) throw notFound('listing_not_found');
    assertCanManage(req.user, listing);

    const isOwner = listing.user_id === req.user.id;
    const data = validate(listingSchema.partial(), req.body);
    if (data.title || data.description) moderationScan({ title: data.title ?? listing.title, description: data.description ?? listing.description });
    const merged = {
      city_id: data.city_id ?? listing.city_id,
      area_id: data.area_id === undefined ? listing.area_id : data.area_id,
      category_id: data.category_id ?? listing.category_id,
    };
    validateTaxonomy(merged);

    const allowed = ['title', 'description', 'category_id', 'price_cents', 'condition', 'city_id', 'area_id', 'lat', 'lng', 'contact_phone'];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (data.negotiable !== undefined) {
      fields.push('negotiable = ?');
      values.push(data.negotiable ? 1 : 0);
    }
    if (data.attributes !== undefined) {
      fields.push('attributes = ?');
      values.push(JSON.stringify(data.attributes));
    }
    if (!fields.length) throw badRequest('nothing_to_update');

    // Edited content goes back to moderation review unless staff edits it.
    const staffEdit = ['admin', 'superadmin', 'moderator'].includes(req.user.role) && !isOwner;
    if (!staffEdit && listing.status === 'active' && (data.title || data.description)) {
      fields.push("status = 'pending'");
    }
    fields.push('updated_at = ?');
    values.push(now(), listing.id);

    db.prepare(`UPDATE listings SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    if (staffEdit) audit(req, 'listing.edited', { entityType: 'listing', entityId: listing.id });

    const updated = db.prepare('SELECT id, public_id, status FROM listings WHERE id = ?').get(listing.id);
    res.json({ ok: true, listing: updated });
  }),
);

/* ------------------------------- actions ------------------------------- */

const statusActionSchema = z.object({ action: z.enum(['pause', 'resume', 'sold', 'republish']) });

router.post(
  '/:id/status',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const { action } = validate(statusActionSchema, req.body);
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(req.params.id));
    if (!listing) throw notFound('listing_not_found');
    assertCanManage(req.user, listing);
    const ts = now();

    if (action === 'pause') {
      if (listing.status !== 'active') throw conflict('only_active_can_pause');
      db.prepare("UPDATE listings SET status='paused', updated_at=? WHERE id=?").run(ts, listing.id);
    } else if (action === 'resume') {
      if (listing.status !== 'paused') throw conflict('only_paused_can_resume');
      const status = listing.expires_at < ts ? 'expired' : 'active';
      if (status === 'expired') throw conflict('listing_expired_republish');
      db.prepare("UPDATE listings SET status='active', updated_at=? WHERE id=?").run(ts, listing.id);
    } else if (action === 'sold') {
      if (!['active', 'paused', 'pending'].includes(listing.status)) throw conflict('cannot_mark_sold');
      db.prepare("UPDATE listings SET status='sold', updated_at=? WHERE id=?").run(ts, listing.id);
      if (listing.store_id) {
        db.prepare('UPDATE stores SET sales_count = sales_count + 1 WHERE id = ?').run(listing.store_id);
      }
    } else {
      republishListing(listing, req.user);
    }

    const fresh = db.prepare('SELECT status, public_id FROM listings WHERE id = ?').get(listing.id);
    res.json({ ok: true, status: fresh.status, public_id: fresh.public_id });
  }),
);

const bumpSchema = z.object({ product_code: z.string().min(2).max(40) });

/** Paid promotions are only applied after a PAID order exists — never before. */
router.post(
  '/:id/promote',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const { product_code } = validate(bumpSchema, req.body);
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(req.params.id));
    if (!listing) throw notFound('listing_not_found');
    assertCanManage(req.user, listing);
    const product = db.prepare('SELECT * FROM boost_products WHERE code = ? AND active = 1').get(product_code);
    if (!product) throw badRequest('invalid_boost_product');

    const reference = `BOOST-${randomToken(6).toUpperCase()}`;
    const info = db
      .prepare(
        `INSERT INTO orders (reference, user_id, kind, boost_id, listing_id, amount_cents, currency, status, provider, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(reference, req.user.id, 'boost', product.id, listing.id, product.price_cents, 'MAD', 'pending', 'manual', now());

    res.status(201).json({
      order: {
        id: Number(info.lastInsertRowid),
        reference,
        amount: product.price_cents / 100,
        currency: 'MAD',
        status: 'pending',
        product: { code: product.code, type: product.type, duration_days: product.duration_days },
      },
      payment_live: false,
      message: 'payment_provider_not_configured',
    });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(req.params.id));
    if (!listing) throw notFound('listing_not_found');
    assertCanManage(req.user, listing);

    const images = db.prepare('SELECT path FROM listing_images WHERE listing_id = ?').all(listing.id);
    db.transaction(() => {
      db.prepare("UPDATE listings SET status='deleted', updated_at=? WHERE id=?").run(now(), listing.id);
      db.prepare('DELETE FROM favorites WHERE listing_id = ?').run(listing.id);
      db.prepare('UPDATE users SET listings_count = MAX(0, listings_count - 1) WHERE id = ?').run(listing.user_id);
    })();
    for (const img of images) await removeListingImageFiles(img.path);

    if (req.user.id !== listing.user_id) {
      audit(req, 'listing.deleted', { entityType: 'listing', entityId: listing.id });
      notify(listing.user_id, {
        type: NOTIFICATION_TYPES.SYSTEM,
        titleKey: 'notif.listing_removed',
        body: listing.title,
        link: '/my-listings',
      });
    }
    res.json({ ok: true });
  }),
);

/* ------------------------------- contact / interest ------------------------------- */

router.post(
  '/:id/contact',
  limiters.write,
  asyncHandler(async (req, res) => {
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(req.params.id));
    if (!listing || listing.status !== 'active') throw notFound('listing_not_found');
    db.prepare('UPDATE listings SET contacts_count = contacts_count + 1 WHERE id = ?').run(listing.id);
    if (req.user && req.user.id !== listing.user_id) {
      notify(listing.user_id, {
        type: NOTIFICATION_TYPES.LISTING_FAVORITED,
        titleKey: 'notif.listing_interest',
        body: listing.title,
        link: `/listing/${listing.public_id}`,
        data: { listing_id: listing.id },
      });
    }
    const fresh = db.prepare('SELECT contacts_count FROM listings WHERE id = ?').get(listing.id);
    res.json({ ok: true, contacts: fresh.contacts_count });
  }),
);

export default router;
