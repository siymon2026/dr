import { db, now, fromJson } from './db.js';
import { badRequest, conflict, forbidden, notFound } from './errors.js';
import { config } from '../config.js';
import { randomToken } from './security.js';
import { notify, NOTIFICATION_TYPES } from './notify.js';
import { audit } from './audit.js';
import { getSettings } from './settings.js';

export const LISTING_TTL_DAYS = 60;

/** Listing lifetime in ms — admin-editable via settings, falls back to 60 days. */
export function listingTtlMs() {
  const days = Number(getSettings().listing_ttl_days) || LISTING_TTL_DAYS;
  return days * 864e5;
}

/** Whether newly created/republished listings go live immediately. */
export function autoApproveEnabled() {
  return !!getSettings().moderation_auto_approve;
}
export const CONDITIONS = ['new', 'used_excellent', 'used_good', 'needs_repair'];

export const PUBLIC_LISTING_COLUMNS = `
  l.id, l.public_id, l.title, l.price_cents, l.currency, l.negotiable, l.condition,
  l.city_id, l.area_id, l.lat, l.lng, l.status, l.views_count, l.favorites_count, l.contacts_count,
  l.is_featured, l.is_pinned, l.created_at, l.published_at, l.bumped_at, l.expires_at,
  l.category_id, l.user_id, l.store_id
`;

export const LISTING_JOINS = `
  FROM listings l
  JOIN categories c ON c.id = l.category_id
  JOIN cities ci ON ci.id = l.city_id
  JOIN users u ON u.id = l.user_id
`;

const imageSubquery = `(SELECT path FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, position, id LIMIT 1)`;

export function mapListingRow(row, { withOwner = true } = {}) {
  if (!row) return null;
  const out = {
    id: row.id,
    public_id: row.public_id,
    title: row.title,
    price: row.price_cents / 100,
    price_cents: row.price_cents,
    currency: row.currency,
    negotiable: !!row.negotiable,
    condition: row.condition,
    status: row.status,
    views: row.views_count,
    favorites: row.favorites_count,
    contacts: row.contacts_count,
    featured: !!row.is_featured,
    pinned: !!row.is_pinned,
    created_at: row.created_at,
    published_at: row.published_at,
    bumped_at: row.bumped_at,
    expires_at: row.expires_at,
    image: row.image || null,
    images_count: row.images_count || undefined,
    category: row.cat_id
      ? { id: row.cat_id, slug: row.cat_slug, name: { ar: row.cat_ar, fr: row.cat_fr, en: row.cat_en }, icon: row.cat_icon }
      : { id: row.category_id, slug: row.category_slug, name: { ar: row.category_ar, fr: row.category_fr, en: row.category_en } },
    city: {
      id: row.city_id,
      slug: row.city_slug,
      name: { ar: row.city_ar, fr: row.city_fr, en: row.city_en },
    },
  };
  if (row.area_ar) out.area = { id: row.area_id, name: { ar: row.area_ar, fr: row.area_fr, en: row.area_en } };
  if (row.description !== undefined) out.description = row.description;
  if (row.attributes !== undefined) out.attributes = fromJson(row.attributes, {});
  if (row.rejection_reason !== undefined) out.rejection_reason = row.rejection_reason;
  if (withOwner && row.owner_name) {
    out.owner = {
      id: row.user_id,
      name: row.owner_name,
      avatar: row.owner_avatar,
      verified: !!row.owner_verified,
      rating_avg: row.owner_rating,
      rating_count: row.owner_rating_count,
      last_seen_at: row.owner_last_seen,
      is_store: !!row.owner_is_store,
      member_since: row.owner_created,
    };
  }
  if (row.store_name) {
    out.store = {
      id: row.store_id,
      name: row.store_name,
      slug: row.store_slug,
      logo: row.store_logo,
      verified: !!row.store_verified,
      rating_avg: row.store_rating,
      followers: row.store_followers,
    };
  }
  return out;
}

/** Escape a user query for FTS5 prefix matching. */
export function ftsQuery(raw) {
  const terms = String(raw || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (!terms.length) return null;
  return terms.map((t) => `"${t}"*`).join(' AND ');
}

export function buildFilters(query, { includeNonPublic = false } = {}) {
  const where = [];
  const params = {};

  if (!includeNonPublic) {
    where.push("l.status = 'active'");
  } else if (query.status) {
    const statuses = String(query.status).split(',').filter(Boolean);
    const allowed = ['draft', 'pending', 'active', 'rejected', 'paused', 'sold', 'expired', 'deleted'];
    const filtered = statuses.filter((s) => allowed.includes(s));
    if (filtered.length) {
      where.push(`l.status IN (${filtered.map((s, i) => `@status${i}`).join(',')})`);
      filtered.forEach((s, i) => (params[`status${i}`] = s));
    }
  }

  if (query.q) {
    const fts = ftsQuery(query.q);
    if (fts) {
      where.push('l.id IN (SELECT rowid FROM listings_fts WHERE listings_fts MATCH @fts)');
      params.fts = fts;
    } else {
      where.push('(l.title LIKE @like OR l.description LIKE @like)');
      params.like = `%${String(query.q).slice(0, 60)}%`;
    }
  }

  if (query.category) {
    const ids = String(query.category)
      .split(',')
      .map((v) => Number.parseInt(v, 10))
      .filter(Number.isInteger);
    if (ids.length) {
      where.push(
        `(l.category_id IN (${ids.map((_, i) => `@cat${i}`).join(',')}) OR c.parent_id IN (${ids
          .map((_, i) => `@cat${i}`)
          .join(',')}))`,
      );
      ids.forEach((v, i) => (params[`cat${i}`] = v));
    }
  }

  if (query.city) {
    const ids = String(query.city)
      .split(',')
      .map((v) => Number.parseInt(v, 10))
      .filter(Number.isInteger);
    if (ids.length) {
      where.push(`l.city_id IN (${ids.map((_, i) => `@city${i}`).join(',')})`);
      ids.forEach((v, i) => (params[`city${i}`] = v));
    }
  }

  if (query.area) {
    const v = Number.parseInt(query.area, 10);
    if (Number.isInteger(v)) {
      where.push('l.area_id = @area');
      params.area = v;
    }
  }

  if (query.min_price !== undefined && query.min_price !== '') {
    const v = Math.round(Number(query.min_price) * 100);
    if (Number.isFinite(v)) {
      where.push('l.price_cents >= @minPrice');
      params.minPrice = v;
    }
  }
  if (query.max_price !== undefined && query.max_price !== '') {
    const v = Math.round(Number(query.max_price) * 100);
    if (Number.isFinite(v)) {
      where.push('l.price_cents <= @maxPrice');
      params.maxPrice = v;
    }
  }

  if (query.condition) {
    const conds = String(query.condition).split(',').filter((c) => CONDITIONS.includes(c));
    if (conds.length) {
      where.push(`l.condition IN (${conds.map((_, i) => `@cond${i}`).join(',')})`);
      conds.forEach((c, i) => (params[`cond${i}`] = c));
    }
  }

  if (query.seller) {
    const v = Number.parseInt(query.seller, 10);
    if (Number.isInteger(v)) {
      where.push('l.user_id = @seller');
      params.seller = v;
    }
  }
  if (query.store) {
    const v = Number.parseInt(query.store, 10);
    if (Number.isInteger(v)) {
      where.push('l.store_id = @store');
      params.store = v;
    }
  }
  if (query.featured === '1' || query.featured === 'true') {
    where.push('l.is_featured = 1');
  }
  if (query.with_photos === '1') {
    where.push('EXISTS (SELECT 1 FROM listing_images li WHERE li.listing_id = l.id)');
  }
  if (query.date_from) {
    const ts = Date.parse(query.date_from);
    if (!Number.isNaN(ts)) {
      where.push('l.created_at >= @dateFrom');
      params.dateFrom = ts;
    }
  }

  // distance filter (haversine, km)
  if (query.lat && query.lng && query.radius) {
    const lat = Number(query.lat);
    const lng = Number(query.lng);
    const radius = Math.min(200, Math.max(1, Number(query.radius)));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const rlat = (lat * Math.PI) / 180;
      const rlng = (lng * Math.PI) / 180;
      params.lat = rlat;
      params.lng = rlng;
      params.cosLat = Math.cos(rlat);
      params.radius = radius;
      const dist = `(6371 * acos(MAX(-1, MIN(1, @cosLat * cos(lat * 0.017453292519943295) * cos((lng * 0.017453292519943295) - @lng) + sin(@lat) * sin(lat * 0.017453292519943295)))))`;
      where.push(`l.lat IS NOT NULL AND l.lng IS NOT NULL AND ${dist} <= @radius`);
      params.__dist = dist;
    }
  }

  return { where, params };
}

const SORTS = {
  newest: 'l.created_at DESC',
  oldest: 'l.created_at ASC',
  price_asc: 'l.price_cents ASC',
  price_desc: 'l.price_cents DESC',
  views: 'l.views_count DESC',
  relevance: 'l.is_pinned DESC, l.is_featured DESC, l.bumped_at DESC, l.created_at DESC',
};

export function searchListings(query, { includeNonPublic = false } = {}) {
  const { where, params } = buildFilters(query, { includeNonPublic });
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(60, Math.max(1, Number.parseInt(query.limit, 10) || 24));
  const offset = (page - 1) * limit;

  const sortKey = SORTS[query.sort] ? query.sort : 'relevance';
  let orderBy = SORTS[sortKey];
  if (sortKey === 'relevance') {
    orderBy = 'l.is_pinned DESC, l.is_featured DESC, l.bumped_at DESC, l.created_at DESC';
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT ${PUBLIC_LISTING_COLUMNS},
              ${imageSubquery} AS image,
              (SELECT COUNT(*) FROM listing_images WHERE listing_id = l.id) AS images_count,
              c.slug AS cat_slug, c.name_ar AS cat_ar, c.name_fr AS cat_fr, c.name_en AS cat_en, c.icon AS cat_icon,
              c.id AS cat_id, c.name_ar AS category_ar, c.name_fr AS category_fr, c.name_en AS category_en,
              c.slug AS category_slug,
              ci.slug AS city_slug, ci.name_ar AS city_ar, ci.name_fr AS city_fr, ci.name_en AS city_en,
              u.name AS owner_name, u.avatar AS owner_avatar, u.verified_seller AS owner_verified,
              u.rating_avg AS owner_rating, u.rating_count AS owner_rating_count,
              u.last_seen_at AS owner_last_seen, u.is_store AS owner_is_store, u.created_at AS owner_created,
              s.name AS store_name, s.slug AS store_slug, s.logo AS store_logo, s.verified AS store_verified,
              s.rating_avg AS store_rating, s.followers_count AS store_followers
       ${LISTING_JOINS}
       LEFT JOIN stores s ON s.id = l.store_id
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset });

  const total = db
    .prepare(`SELECT COUNT(*) AS c ${LISTING_JOINS} ${whereSql}`)
    .get(params).c;

  return {
    items: rows.map((r) => mapListingRow(r)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1, sort: sortKey },
  };
}

export function getListing(publicOrId, { includeNonPublic = false } = {}) {
  const isNumeric = /^\d+$/.test(String(publicOrId));
  const condition = isNumeric ? 'l.id = @key' : 'l.public_id = @key';
  const row = db
    .prepare(
      `SELECT ${PUBLIC_LISTING_COLUMNS}, l.description, l.attributes, l.rejection_reason, l.contact_phone,
              l.moderated_at, ${imageSubquery} AS image,
              c.slug AS cat_slug, c.name_ar AS cat_ar, c.name_fr AS cat_fr, c.name_en AS cat_en, c.icon AS cat_icon,
              c.id AS cat_id, c.name_ar AS category_ar, c.name_fr AS category_fr, c.name_en AS category_en,
              c.slug AS category_slug,
              ci.slug AS city_slug, ci.name_ar AS city_ar, ci.name_fr AS city_fr, ci.name_en AS city_en,
              ar.name_ar AS area_ar, ar.name_fr AS area_fr, ar.name_en AS area_en,
              u.name AS owner_name, u.avatar AS owner_avatar, u.verified_seller AS owner_verified,
              u.rating_avg AS owner_rating, u.rating_count AS owner_rating_count,
              u.last_seen_at AS owner_last_seen, u.is_store AS owner_is_store, u.created_at AS owner_created,
              u.show_phone AS owner_show_phone, u.phone AS owner_phone,
              s.name AS store_name, s.slug AS store_slug, s.logo AS store_logo, s.verified AS store_verified,
              s.rating_avg AS store_rating, s.followers_count AS store_followers
       ${LISTING_JOINS}
       LEFT JOIN areas ar ON ar.id = l.area_id
       LEFT JOIN stores s ON s.id = l.store_id
       WHERE ${condition}`,
    )
    .get({ key: isNumeric ? Number(publicOrId) : String(publicOrId) });

  if (!row) throw notFound('listing_not_found');
  if (!includeNonPublic && row.status !== 'active') throw notFound('listing_not_found');
  return row;
}

export function listingImages(listingId) {
  return db
    .prepare('SELECT id, path, thumb, width, height, position, is_primary FROM listing_images WHERE listing_id = ? ORDER BY is_primary DESC, position, id')
    .all(listingId);
}

export function assertCanManage(user, listing) {
  if (!user) throw forbidden();
  if (listing.user_id === user.id) return;
  if (['admin', 'superadmin', 'moderator'].includes(user.role)) return;
  throw forbidden('not_listing_owner');
}

/** Content checks before a listing is created/updated. */
export function moderationScan({ title, description }) {
  const text = `${title} ${description}`.toLowerCase();
  const hits = config.moderation.bannedTerms.filter((term) => term && text.includes(term));
  if (hits.length) {
    throw badRequest('prohibited_content', { terms: hits.slice(0, 3) });
  }
  if (/(https?:\/\/|www\.)\S+/i.test(description) && (description.match(/https?:\/\//g) || []).length > 2) {
    throw badRequest('too_many_links');
  }
  return { ok: true };
}

export function quotaFor(userId) {
  const sub = db
    .prepare(
      `SELECT s.*, p.listing_quota, p.featured_quota, p.name_ar
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = ? AND s.status = 'active' AND s.ends_at > ?
       ORDER BY s.ends_at DESC LIMIT 1`,
    )
    .get(userId, now());
  const activeCount = db
    .prepare("SELECT COUNT(*) c FROM listings WHERE user_id = ? AND status IN ('active','pending','paused')")
    .get(userId).c;
  const freeQuota = getSettings().free_listing_quota;
  if (!sub) {
    return { plan: null, quota: freeQuota, used: activeCount, remaining: Math.max(0, freeQuota - activeCount) };
  }
  return {
    plan: { id: sub.plan_id, name_ar: sub.name_ar, ends_at: sub.ends_at },
    quota: sub.listing_quota,
    used: activeCount,
    remaining: Math.max(0, sub.listing_quota - activeCount),
    featured_quota: sub.featured_quota,
  };
}

export function createListingRecord(user, data) {
  const ts = now();
  const publicId = randomToken(9).replace(/[-_]/g, '').slice(0, 12);
  const status = autoApproveEnabled() ? 'active' : 'pending';
  const info = db
    .prepare(
      `INSERT INTO listings (
        public_id, user_id, store_id, category_id, title, description, price_cents, currency, negotiable,
        condition, city_id, area_id, lat, lng, attributes, contact_phone, status, expires_at, published_at,
        created_at, updated_at, bumped_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      publicId,
      user.id,
      data.store_id ?? null,
      data.category_id,
      data.title,
      data.description,
      data.price_cents,
      'MAD',
      data.negotiable ? 1 : 0,
      data.condition,
      data.city_id,
      data.area_id ?? null,
      data.lat ?? null,
      data.lng ?? null,
      data.attributes ? JSON.stringify(data.attributes) : null,
      data.contact_phone ?? user.phone ?? null,
      status,
      ts + listingTtlMs(),
      status === 'active' ? ts : null,
      ts,
      ts,
      ts,
    );

  const listingId = Number(info.lastInsertRowid);
  db.prepare('UPDATE users SET listings_count = listings_count + 1 WHERE id = ?').run(user.id);

  if (status === 'pending') {
    db.prepare(
      "INSERT INTO notifications (user_id, type, title_key, body, link, created_at) VALUES (?,?,?,?,?,?)",
    ).run(user.id, NOTIFICATION_TYPES.SYSTEM, 'notif.listing_pending', data.title, '/my-listings', ts);
  }
  return { id: listingId, publicId, status };
}

export function republishListing(listing, actor) {
  if (!['paused', 'expired', 'rejected', 'sold'].includes(listing.status)) {
    throw conflict('listing_cannot_be_republished');
  }
  const ts = now();
  const status = autoApproveEnabled() ? 'active' : 'pending';
  db.prepare(
    `UPDATE listings SET status = ?, expires_at = ?, published_at = COALESCE(published_at, ?), bumped_at = ?,
       rejection_reason = NULL, updated_at = ? WHERE id = ?`,
  ).run(status, ts + listingTtlMs(), ts, ts, ts, listing.id);
  return status;
}

export function moderateListing(req, listingId, decision, reason) {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);
  if (!listing) throw notFound('listing_not_found');
  const ts = now();
  const status = decision === 'approve' ? 'active' : 'rejected';
  db.prepare(
    `UPDATE listings SET status = ?, rejection_reason = ?, moderated_by = ?, moderated_at = ?, updated_at = ?,
       published_at = CASE WHEN ? = 'active' AND published_at IS NULL THEN ? ELSE published_at END
     WHERE id = ?`,
  ).run(status, decision === 'reject' ? reason || null : null, req.user.id, ts, ts, status, ts, listingId);

  notify(listing.user_id, {
    type: decision === 'approve' ? NOTIFICATION_TYPES.LISTING_APPROVED : NOTIFICATION_TYPES.LISTING_REJECTED,
    titleKey: decision === 'approve' ? 'notif.listing_approved' : 'notif.listing_rejected',
    body: decision === 'approve' ? listing.title : reason || '',
    link: `/listing/${listing.public_id}`,
    data: { listing_id: listingId },
  });
  audit(req, `listing.${decision}`, { entityType: 'listing', entityId: listingId, meta: { reason } });
  return status;
}

export function incrementView(listing, { userId = null, visitorKey }) {
  const ts = now();
  const seen = db
    .prepare('SELECT 1 FROM listing_views WHERE listing_id = ? AND visitor_key = ? AND created_at > ? LIMIT 1')
    .get(listing.id, visitorKey, ts - 30 * 60 * 1000);
  if (seen) return false;
  db.prepare('INSERT INTO listing_views (listing_id, user_id, visitor_key, created_at) VALUES (?,?,?,?)').run(
    listing.id,
    userId,
    visitorKey,
    ts,
  );
  db.prepare('UPDATE listings SET views_count = views_count + 1 WHERE id = ?').run(listing.id);
  if (listing.store_id) {
    db.prepare('UPDATE stores SET views_count = views_count + 1 WHERE id = ?').run(listing.store_id);
  }
  return true;
}

export const { NOTIFICATION_TYPES: _nt } = { NOTIFICATION_TYPES };
