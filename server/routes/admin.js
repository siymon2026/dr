import { Router } from 'express';
import { db, now, toJson, fromJson } from '../lib/db.js';
import { getSettings, saveSetting, invalidateSettings, SETTING_DEFAULTS } from '../lib/settings.js';
import { z, validate, text, booleanish } from '../lib/validation.js';
import { requireAuth, requirePermission, loadUser, serializeUser } from '../lib/auth.js';
import { can, canAssignRole, roleRank, ROLES } from '../lib/permissions.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { limiters } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { slugify, cleanText, hashPassword, passwordIssues } from '../lib/security.js';
import { moderateListing } from '../lib/listings.js';
import { notify, NOTIFICATION_TYPES } from '../lib/notify.js';
import { onlineUserCount } from '../lib/realtime.js';
import { applyPaidOrder } from '../lib/billing.js';
import { sendMail } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';

const router = Router();
router.use(requireAuth);

/* ============================== dashboard ============================== */

router.get(
  '/stats',
  requirePermission('dashboard.view'),
  asyncHandler(async (_req, res) => {
    const ts = now();
    const day = 864e5;
    const count = (sql, ...params) => db.prepare(sql).get(...params).c;

    const revenue = db
      .prepare("SELECT COALESCE(SUM(amount_cents - discount_cents),0) c FROM orders WHERE status='paid'")
      .get().c;

    const series = [];
    for (let i = 13; i >= 0; i -= 1) {
      const from = ts - (i + 1) * day;
      const to = ts - i * day;
      series.push({
        date: new Date(to).toISOString().slice(0, 10),
        listings: count('SELECT COUNT(*) c FROM listings WHERE created_at BETWEEN ? AND ?', from, to),
        users: count('SELECT COUNT(*) c FROM users WHERE created_at BETWEEN ? AND ?', from, to),
        views: count('SELECT COUNT(*) c FROM listing_views WHERE created_at BETWEEN ? AND ?', from, to),
        revenue: db
          .prepare("SELECT COALESCE(SUM(amount_cents - discount_cents),0) c FROM orders WHERE status='paid' AND paid_at BETWEEN ? AND ?")
          .get(from, to).c / 100,
      });
    }

    res.json({
      users: {
        total: count('SELECT COUNT(*) c FROM users'),
        active: count("SELECT COUNT(*) c FROM users WHERE status='active'"),
        suspended: count("SELECT COUNT(*) c FROM users WHERE status='suspended'"),
        banned: count("SELECT COUNT(*) c FROM users WHERE status='banned'"),
        sellers: count("SELECT COUNT(DISTINCT user_id) c FROM listings WHERE status='active'"),
        stores: count('SELECT COUNT(*) c FROM stores'),
        new_today: count('SELECT COUNT(*) c FROM users WHERE created_at > ?', ts - day),
        online: onlineUserCount(),
      },
      stores: {
        total: count('SELECT COUNT(*) c FROM stores'),
        active: count("SELECT COUNT(*) c FROM stores WHERE status='active'"),
        pending: count("SELECT COUNT(*) c FROM stores WHERE status='pending'"),
        verified: count('SELECT COUNT(*) c FROM stores WHERE verified=1'),
      },
      listings: {
        total: count('SELECT COUNT(*) c FROM listings'),
        active: count("SELECT COUNT(*) c FROM listings WHERE status='active'"),
        pending: count("SELECT COUNT(*) c FROM listings WHERE status='pending'"),
        rejected: count("SELECT COUNT(*) c FROM listings WHERE status='rejected'"),
        featured: count("SELECT COUNT(*) c FROM listings WHERE is_featured=1 AND status='active'"),
        sold: count("SELECT COUNT(*) c FROM listings WHERE status='sold'"),
        expired: count("SELECT COUNT(*) c FROM listings WHERE status='expired'"),
        new_today: count('SELECT COUNT(*) c FROM listings WHERE created_at > ?', ts - day),
      },
      engagement: {
        views: count('SELECT COUNT(*) c FROM listing_views'),
        favorites: count('SELECT COUNT(*) c FROM favorites'),
        messages: count('SELECT COUNT(*) c FROM messages'),
        conversations: count('SELECT COUNT(*) c FROM conversations'),
        reviews: count('SELECT COUNT(*) c FROM reviews'),
      },
      finance: {
        revenue: revenue / 100,
        revenue_today:
          db.prepare("SELECT COALESCE(SUM(amount_cents - discount_cents),0) c FROM orders WHERE status='paid' AND paid_at > ?").get(ts - day).c / 100,
        paid_orders: count("SELECT COUNT(*) c FROM orders WHERE status='paid'"),
        pending_orders: count("SELECT COUNT(*) c FROM orders WHERE status='pending'"),
        active_subscriptions: count("SELECT COUNT(*) c FROM subscriptions WHERE status='active' AND ends_at > ?", ts),
      },
      moderation: {
        open_reports: count("SELECT COUNT(*) c FROM reports WHERE status='open'"),
        pending_listings: count("SELECT COUNT(*) c FROM listings WHERE status='pending'"),
        pending_stores: count("SELECT COUNT(*) c FROM stores WHERE status='pending'"),
      },
      series,
    });
  }),
);

/* ============================== users ============================== */

router.get(
  '/users',
  requirePermission('users.view'),
  asyncHandler(async (req, res) => {
    const where = ['1=1'];
    const params = {};
    if (req.query.q) {
      where.push('(u.name LIKE @q OR u.email LIKE @q OR u.phone LIKE @q)');
      params.q = `%${String(req.query.q).slice(0, 60)}%`;
    }
    if (req.query.status) {
      where.push('u.status = @status');
      params.status = String(req.query.status);
    }
    if (req.query.role) {
      where.push('u.role = @role');
      params.role = String(req.query.role);
    }
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const page = Math.max(1, Number(req.query.page) || 1);
    params.limit = limit;
    params.offset = (page - 1) * limit;

    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.verified_seller, u.is_store,
                u.rating_avg, u.rating_count, u.listings_count, u.created_at, u.last_seen_at,
                (SELECT COUNT(*) FROM listings l WHERE l.user_id = u.id AND l.status='active') AS active_listings,
                (SELECT COUNT(*) FROM reports r WHERE r.target_type='user' AND r.target_id=u.id AND r.status='open') AS open_reports
         FROM users u WHERE ${where.join(' AND ')}
         ORDER BY u.created_at DESC LIMIT @limit OFFSET @offset`,
      )
      .all(params);
    const total = db.prepare(`SELECT COUNT(*) c FROM users u WHERE ${where.join(' AND ')}`).get(params).c;
    res.json({ items: rows, pagination: { page, limit, total } });
  }),
);

router.get(
  '/users/:id',
  requirePermission('users.view'),
  asyncHandler(async (req, res) => {
    const user = loadUser(Number(req.params.id));
    if (!user) throw notFound('user_not_found');
    const activityRows = db
      .prepare('SELECT action, meta, ip, created_at FROM activity_log WHERE user_id = ? ORDER BY id DESC LIMIT 60')
      .all(user.id);
    const reports = db
      .prepare("SELECT id, reason, details, status, created_at FROM reports WHERE target_type='user' AND target_id=? ORDER BY id DESC LIMIT 20")
      .all(user.id);
    const orders = db
      .prepare('SELECT reference, kind, amount_cents, status, created_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 20')
      .all(user.id);
    res.json({ user: serializeUser(user, { self: true }), activity: activityRows, reports, orders });
  }),
);

const adminUserUpdate = z.object({
  name: text(2, 60).optional(),
  email: z.string().email().max(190).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  status_reason: text(0, 300).nullable().optional(),
  verified_seller: z.boolean().optional(),
  is_store: z.boolean().optional(),
  role: z.enum(ROLES).optional(),
});

router.patch(
  '/users/:id',
  requirePermission('users.edit'),
  asyncHandler(async (req, res) => {
    const target = loadUser(Number(req.params.id));
    if (!target) throw notFound('user_not_found');
    const data = validate(adminUserUpdate, req.body);

    // Role changes require the dedicated permission + rank guard.
    if (data.role && data.role !== target.role) {
      if (!can(req.user, 'users.roles')) throw forbidden('role_change_not_allowed');
      if (!canAssignRole(req.user, data.role)) throw forbidden('cannot_grant_role');
      if (roleRank(data.role) >= roleRank(req.user.role)) throw forbidden('cannot_grant_equal_or_higher_role');
    }
    if (data.status && ['admin', 'superadmin'].includes(target.role) && target.id !== req.user.id) {
      if (roleRank(req.user.role) <= roleRank(target.role)) throw forbidden('cannot_moderate_peer_admin');
    }
    if (data.status && data.status !== 'active' && target.id === req.user.id) {
      throw badRequest('cannot_disable_self');
    }
    if (data.email) {
      const clash = db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(data.email, target.id);
      if (clash) throw conflict('email_taken');
    }

    const fields = [];
    const values = [];
    for (const key of ['name', 'email', 'phone', 'status', 'status_reason', 'role']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    for (const key of ['verified_seller', 'is_store']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key] ? 1 : 0);
      }
    }
    if (!fields.length) throw badRequest('nothing_to_update');
    fields.push('updated_at = ?');
    values.push(now(), target.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    if (data.status && data.status !== 'active') {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
      db.prepare("UPDATE listings SET status='paused', updated_at=? WHERE user_id=? AND status='active'").run(now(), target.id);
    }
    if (req.user.id === target.id && data.role && data.role !== target.role) {
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(target.id, req.session.id);
    }

    audit(req, 'user.updated', { entityType: 'user', entityId: target.id, meta: Object.keys(data) });
    if (data.status && data.status !== 'active') {
      notify(target.id, {
        type: NOTIFICATION_TYPES.ACCOUNT_UPDATE,
        titleKey: `notif.account_${data.status}`,
        body: data.status_reason || '',
        link: '/account',
      });
    }
    if (data.verified_seller) {
      notify(target.id, {
        type: NOTIFICATION_TYPES.ACCOUNT_UPDATE,
        titleKey: 'notif.seller_verified',
        link: '/account',
      });
    }
    res.json({ user: serializeUser(loadUser(target.id), { self: true }) });
  }),
);

router.post(
  '/users/:id/reset-password',
  requirePermission('users.edit'),
  asyncHandler(async (req, res) => {
    const target = loadUser(Number(req.params.id));
    if (!target) throw notFound('user_not_found');
    const { password } = validate(z.object({ password: z.string().min(8).max(200) }), req.body);
    const issues = passwordIssues(password);
    if (issues.length) throw badRequest('weak_password', { password: issues.join(',') });
    db.prepare('UPDATE users SET password_hash=?, token_version=token_version+1, updated_at=? WHERE id=?').run(
      hashPassword(password),
      now(),
      target.id,
    );
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    audit(req, 'user.password_reset', { entityType: 'user', entityId: target.id });
    res.json({ ok: true });
  }),
);

router.post(
  '/users/:id/permissions',
  requirePermission('staff.manage'),
  asyncHandler(async (req, res) => {
    const { permissions } = validate(z.object({ permissions: z.array(z.string().max(60)).max(40) }), req.body);
    const target = loadUser(Number(req.params.id));
    if (!target) throw notFound('user_not_found');
    if (target.id === req.user.id) throw forbidden('cannot_edit_own_permissions');
    db.transaction(() => {
      db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(target.id);
      for (const p of permissions) {
        db.prepare('INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) VALUES (?,?,?,?)').run(
          target.id,
          p,
          req.user.id,
          now(),
        );
      }
    })();
    audit(req, 'user.permissions_updated', { entityType: 'user', entityId: target.id, meta: permissions });
    res.json({ ok: true });
  }),
);

/* ============================== listings ============================== */

router.get(
  '/listings',
  requirePermission('listings.view'),
  asyncHandler(async (req, res) => {
    const where = ['1=1'];
    const params = {};
    if (req.query.status && req.query.status !== 'all') {
      const statuses = String(req.query.status).split(',').filter((s) => /^[a-z_]+$/.test(s));
      if (statuses.length) {
        where.push(`l.status IN (${statuses.map((_, i) => `@s${i}`).join(',')})`);
        statuses.forEach((s, i) => (params[`s${i}`] = s));
      }
    }
    if (req.query.q) {
      where.push('(l.title LIKE @q OR u.name LIKE @q)');
      params.q = `%${String(req.query.q).slice(0, 60)}%`;
    }
    if (req.query.category) {
      where.push('l.category_id = @category');
      params.category = Number(req.query.category);
    }
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const page = Math.max(1, Number(req.query.page) || 1);
    params.limit = limit;
    params.offset = (page - 1) * limit;

    const rows = db
      .prepare(
        `SELECT l.id, l.public_id, l.title, l.price_cents, l.currency, l.status, l.condition, l.is_featured,
                l.views_count, l.created_at, l.rejection_reason,
                c.name_ar AS category_ar, u.id AS user_id, u.name AS owner_name, u.email AS owner_email,
                ci.name_ar AS city_ar,
                (SELECT path FROM listing_images WHERE listing_id=l.id ORDER BY is_primary DESC, position LIMIT 1) AS image,
                (SELECT COUNT(*) FROM reports r WHERE r.target_type='listing' AND r.target_id=l.id AND r.status='open') AS open_reports
         FROM listings l
         JOIN categories c ON c.id = l.category_id
         JOIN users u ON u.id = l.user_id
         JOIN cities ci ON ci.id = l.city_id
         WHERE ${where.join(' AND ')}
         ORDER BY CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.created_at DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all(params);
    const total = db
      .prepare(`SELECT COUNT(*) c FROM listings l JOIN users u ON u.id=l.user_id WHERE ${where.join(' AND ')}`)
      .get(params).c;
    res.json({ items: rows, pagination: { page, limit, total } });
  }),
);

router.post(
  '/listings/:id/moderate',
  requirePermission('listings.moderate'),
  asyncHandler(async (req, res) => {
    const { decision, category_id } = validate(
      z.object({
        decision: z.enum(['approve', 'reject']),
        reason: text(0, 300).optional(),
        category_id: z.coerce.number().int().positive().optional(),
      }),
      req.body,
    );
    if (decision === 'reject' && !req.body.reason) throw badRequest('reason_required');
    if (category_id) {
      if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(category_id)) throw badRequest('invalid_category');
      db.prepare('UPDATE listings SET category_id = ? WHERE id = ?').run(category_id, Number(req.params.id));
    }
    const status = moderateListing(req, Number(req.params.id), decision, req.body.reason);
    res.json({ ok: true, status });
  }),
);

router.post(
  '/listings/bulk-moderate',
  requirePermission('listings.moderate'),
  asyncHandler(async (req, res) => {
    const { ids, decision } = validate(
      z.object({
        ids: z.array(z.coerce.number().int().positive()).min(1).max(100),
        decision: z.enum(['approve', 'reject']),
        reason: text(0, 300).optional(),
      }),
      req.body,
    );
    const results = ids.map((id) => ({
      id,
      status: moderateListing(req, id, decision, req.body.reason || 'bulk'),
    }));
    res.json({ ok: true, results });
  }),
);

router.patch(
  '/listings/:id',
  requirePermission('listings.edit'),
  asyncHandler(async (req, res) => {
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(req.params.id));
    if (!listing) throw notFound('listing_not_found');
    const data = validate(
      z.object({
        title: text(6, 110).optional(),
        category_id: z.coerce.number().int().positive().optional(),
        is_featured: z.boolean().optional(),
        is_pinned: z.boolean().optional(),
        status: z.enum(['active', 'paused', 'rejected', 'expired', 'sold', 'deleted']).optional(),
      }),
      req.body,
    );
    const fields = [];
    const values = [];
    for (const key of ['title', 'category_id', 'status']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    for (const key of ['is_featured', 'is_pinned']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key] ? 1 : 0);
        if (key === 'is_featured') {
          fields.push('featured_until = ?');
          values.push(data[key] ? now() + 30 * 864e5 : null);
        }
        if (key === 'is_pinned') {
          fields.push('pinned_until = ?');
          values.push(data[key] ? now() + 30 * 864e5 : null);
        }
      }
    }
    if (!fields.length) throw badRequest('nothing_to_update');
    fields.push('updated_at = ?');
    values.push(now(), listing.id);
    db.prepare(`UPDATE listings SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    audit(req, 'listing.admin_updated', { entityType: 'listing', entityId: listing.id, meta: Object.keys(data) });
    res.json({ ok: true });
  }),
);

router.delete(
  '/listings/:id',
  requirePermission('listings.delete'),
  asyncHandler(async (req, res) => {
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(req.params.id));
    if (!listing) throw notFound('listing_not_found');
    db.prepare("UPDATE listings SET status='deleted', updated_at=? WHERE id=?").run(now(), listing.id);
    audit(req, 'listing.admin_deleted', {
      entityType: 'listing',
      entityId: listing.id,
      meta: { reason: req.body?.reason || null },
    });
    notify(listing.user_id, {
      type: NOTIFICATION_TYPES.SYSTEM,
      titleKey: 'notif.listing_removed',
      body: listing.title,
      link: '/my-listings',
    });
    res.json({ ok: true });
  }),
);

/* ============================== stores ============================== */

router.get(
  '/stores',
  requirePermission('stores.view'),
  asyncHandler(async (req, res) => {
    const where = ['1=1'];
    const params = {};
    if (req.query.status && req.query.status !== 'all') {
      where.push('s.status = @status');
      params.status = String(req.query.status);
    }
    if (req.query.q) {
      where.push('(s.name LIKE @q OR u.name LIKE @q)');
      params.q = `%${String(req.query.q).slice(0, 60)}%`;
    }
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const page = Math.max(1, Number(req.query.page) || 1);
    params.limit = limit;
    params.offset = (page - 1) * limit;
    const rows = db
      .prepare(
        `SELECT s.*, u.name AS owner_name, u.email AS owner_email, ci.name_ar AS city_ar,
                (SELECT COUNT(*) FROM listings l WHERE l.store_id = s.id AND l.status='active') AS listings_count
         FROM stores s JOIN users u ON u.id = s.user_id LEFT JOIN cities ci ON ci.id = s.city_id
         WHERE ${where.join(' AND ')} ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.created_at DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all(params);
    const total = db
      .prepare(`SELECT COUNT(*) c FROM stores s JOIN users u ON u.id=s.user_id WHERE ${where.join(' AND ')}`)
      .get(params).c;
    res.json({ items: rows, pagination: { page, limit, total } });
  }),
);

router.post(
  '/stores/:id/status',
  requirePermission('stores.moderate'),
  asyncHandler(async (req, res) => {
    const { status } = validate(
      z.object({ status: z.enum(['active', 'suspended', 'rejected', 'pending']), reason: text(0, 300).optional() }),
      req.body,
    );
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(Number(req.params.id));
    if (!store) throw notFound('store_not_found');
    db.prepare('UPDATE stores SET status = ?, status_reason = ?, updated_at = ? WHERE id = ?').run(
      status,
      status === 'suspended' || status === 'rejected' ? req.body?.reason || null : null,
      now(),
      store.id,
    );
    if (status !== 'active') {
      db.prepare("UPDATE listings SET status='paused', updated_at=? WHERE store_id=? AND status='active'").run(now(), store.id);
    }
    audit(req, 'store.status_changed', { entityType: 'store', entityId: store.id, meta: { status } });
    notify(store.user_id, {
      type: NOTIFICATION_TYPES.STORE_UPDATE,
      titleKey: `notif.store_${status}`,
      body: req.body?.reason || '',
      link: '/store/manage',
    });
    res.json({ ok: true });
  }),
);

router.post(
  '/stores/:id/verify',
  requirePermission('stores.verify'),
  asyncHandler(async (req, res) => {
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(Number(req.params.id));
    if (!store) throw notFound('store_not_found');
    const { verified } = validate(z.object({ verified: z.boolean() }), req.body);
    db.prepare('UPDATE stores SET verified = ?, updated_at = ? WHERE id = ?').run(verified ? 1 : 0, now(), store.id);
    db.prepare('UPDATE users SET verified_seller = ? WHERE id = ?').run(verified ? 1 : 0, store.user_id);
    audit(req, 'store.verification_changed', { entityType: 'store', entityId: store.id, meta: { verified } });
    notify(store.user_id, {
      type: NOTIFICATION_TYPES.STORE_UPDATE,
      titleKey: verified ? 'notif.store_verified' : 'notif.store_unverified',
      link: '/store/manage',
    });
    res.json({ ok: true });
  }),
);

/* ============================== finance ============================== */

router.get(
  '/finance/summary',
  requirePermission('finance.view'),
  asyncHandler(async (_req, res) => {
    const byKind = db
      .prepare("SELECT kind, COUNT(*) c, COALESCE(SUM(amount_cents - discount_cents),0) total FROM orders WHERE status='paid' GROUP BY kind")
      .all();
    const byProvider = db
      .prepare("SELECT provider, COUNT(*) c, COALESCE(SUM(amount_cents - discount_cents),0) total FROM orders WHERE status='paid' GROUP BY provider")
      .all();
    const recent = db
      .prepare(
        `SELECT o.reference, o.kind, o.status, o.amount_cents, o.discount_cents, o.provider, o.created_at, o.paid_at,
                u.name AS user_name, u.email
         FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 50`,
      )
      .all();
    res.json({
      by_kind: byKind.map((r) => ({ ...r, total: r.total / 100 })),
      by_provider: byProvider.map((r) => ({ ...r, total: r.total / 100 })),
      recent,
      revenue_total: byKind.reduce((s, r) => s + r.total, 0) / 100,
    });
  }),
);

router.get(
  '/finance/export.csv',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT o.reference, o.kind, o.status, o.amount_cents, o.discount_cents, o.currency, o.provider,
                o.created_at, o.paid_at, u.email, u.name
         FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 10000`,
      )
      .all();
    const header = 'reference,kind,status,amount_mad,discount_mad,currency,provider,created_at,paid_at,user_email,user_name\n';
    const body = rows
      .map((r) =>
        [
          r.reference,
          r.kind,
          r.status,
          (r.amount_cents / 100).toFixed(2),
          (r.discount_cents / 100).toFixed(2),
          r.currency,
          r.provider,
          new Date(r.created_at).toISOString(),
          r.paid_at ? new Date(r.paid_at).toISOString() : '',
          `"${(r.email || '').replace(/"/g, '')}"`,
          `"${(r.name || '').replace(/"/g, '')}"`,
        ].join(','),
      )
      .join('\n');
    audit(req, 'finance.exported_csv');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bii3chri-orders.csv"');
    res.send(`\uFEFF${header}${body}`);
  }),
);

router.get(
  '/orders',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const where = ['1=1'];
    const params = {};
    if (req.query.status) {
      where.push('o.status = @status');
      params.status = String(req.query.status);
    }
    params.limit = Math.min(100, Number(req.query.limit) || 40);
    params.offset = ((Math.max(1, Number(req.query.page) || 1)) - 1) * params.limit;
    const rows = db
      .prepare(
        `SELECT o.*, u.name AS user_name, u.email, p.name_ar AS plan_name, b.name_ar AS boost_name, l.title AS listing_title
         FROM orders o JOIN users u ON u.id=o.user_id
         LEFT JOIN plans p ON p.id=o.plan_id LEFT JOIN boost_products b ON b.id=o.boost_id
         LEFT JOIN listings l ON l.id=o.listing_id
         WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT @limit OFFSET @offset`,
      )
      .all(params);
    res.json({ items: rows });
  }),
);

router.post(
  '/orders/:id/pay',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
    if (!order) throw notFound('order_not_found');
    if (order.status === 'paid') throw conflict('already_paid');
    applyPaidOrder(order.id, { provider: 'manual', providerRef: `staff-${req.user.id}` });
    audit(req, 'order.marked_paid', { entityType: 'order', entityId: order.id });
    res.json({ ok: true });
  }),
);

/* plans */
router.get(
  '/plans',
  requirePermission('finance.view'),
  asyncHandler(async (_req, res) => {
    const plans = db.prepare('SELECT * FROM plans ORDER BY sort').all();
    const boosts = db.prepare('SELECT * FROM boost_products ORDER BY sort').all();
    res.json({ plans, boosts });
  }),
);

const planSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/),
  name_ar: text(2, 60),
  name_fr: text(2, 60),
  name_en: text(2, 60),
  description_ar: text(0, 300).optional(),
  description_fr: text(0, 300).optional(),
  description_en: text(0, 300).optional(),
  price_cents: z.coerce.number().int().min(0),
  duration_days: z.coerce.number().int().min(1).max(3650),
  listing_quota: z.coerce.number().int().min(1).max(10000),
  featured_quota: z.coerce.number().int().min(0).max(1000),
  is_store_plan: z.boolean().default(false),
  features: z.array(z.string().max(120)).max(12).default([]),
  active: z.boolean().default(true),
  sort: z.coerce.number().int().default(0),
});

router.post(
  '/plans',
  requirePermission('plans.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(planSchema, req.body);
    if (db.prepare('SELECT 1 FROM plans WHERE code = ?').get(d.code)) throw conflict('code_exists');
    const info = db
      .prepare(
        `INSERT INTO plans (code, name_ar, name_fr, name_en, description_ar, description_fr, description_en,
          price_cents, currency, duration_days, listing_quota, featured_quota, is_store_plan, features, active, sort, created_at)
         VALUES (?,?,?,?,?,?,?,?,'MAD',?,?,?,?,?,?,?,?)`,
      )
      .run(
        d.code,
        d.name_ar,
        d.name_fr,
        d.name_en,
        d.description_ar || null,
        d.description_fr || null,
        d.description_en || null,
        d.price_cents,
        d.duration_days,
        d.listing_quota,
        d.featured_quota,
        d.is_store_plan ? 1 : 0,
        toJson(d.features),
        d.active ? 1 : 0,
        d.sort,
        now(),
      );
    audit(req, 'plan.created', { entityType: 'plan', entityId: Number(info.lastInsertRowid) });
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }),
);

router.patch(
  '/plans/:id',
  requirePermission('plans.manage'),
  asyncHandler(async (req, res) => {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(Number(req.params.id));
    if (!plan) throw notFound('plan_not_found');
    const d = validate(planSchema.partial(), req.body);
    const allowed = ['code', 'name_ar', 'name_fr', 'name_en', 'description_ar', 'description_fr', 'description_en', 'price_cents', 'duration_days', 'listing_quota', 'featured_quota', 'sort'];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (d[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(d[key]);
      }
    }
    if (d.active !== undefined) {
      fields.push('active = ?');
      values.push(d.active ? 1 : 0);
    }
    if (d.is_store_plan !== undefined) {
      fields.push('is_store_plan = ?');
      values.push(d.is_store_plan ? 1 : 0);
    }
    if (d.features !== undefined) {
      fields.push('features = ?');
      values.push(toJson(d.features));
    }
    if (!fields.length) throw badRequest('nothing_to_update');
    values.push(plan.id);
    db.prepare(`UPDATE plans SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    audit(req, 'plan.updated', { entityType: 'plan', entityId: plan.id, meta: Object.keys(d) });
    res.json({ ok: true });
  }),
);

router.delete(
  '/plans/:id',
  requirePermission('plans.manage'),
  asyncHandler(async (req, res) => {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(Number(req.params.id));
    if (!plan) throw notFound('plan_not_found');
    db.prepare('UPDATE plans SET active = 0 WHERE id = ?').run(plan.id);
    audit(req, 'plan.deactivated', { entityType: 'plan', entityId: plan.id });
    res.json({ ok: true });
  }),
);

/* boosts */
const boostSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/),
  type: z.enum(['feature', 'pin', 'bump']),
  name_ar: text(2, 60),
  name_fr: text(2, 60),
  name_en: text(2, 60),
  price_cents: z.coerce.number().int().min(0),
  duration_days: z.coerce.number().int().min(1).max(365),
  active: z.boolean().default(true),
  sort: z.coerce.number().int().default(0),
});

router.post(
  '/boosts',
  requirePermission('plans.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(boostSchema, req.body);
    if (db.prepare('SELECT 1 FROM boost_products WHERE code = ?').get(d.code)) throw conflict('code_exists');
    const info = db
      .prepare(
        `INSERT INTO boost_products (code, type, name_ar, name_fr, name_en, price_cents, duration_days, active, sort)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(d.code, d.type, d.name_ar, d.name_fr, d.name_en, d.price_cents, d.duration_days, d.active ? 1 : 0, d.sort);
    audit(req, 'boost.created', { entityType: 'boost', entityId: Number(info.lastInsertRowid) });
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }),
);

router.patch(
  '/boosts/:id',
  requirePermission('plans.manage'),
  asyncHandler(async (req, res) => {
    const boost = db.prepare('SELECT * FROM boost_products WHERE id = ?').get(Number(req.params.id));
    if (!boost) throw notFound('boost_not_found');
    const d = validate(boostSchema.partial(), req.body);
    const fields = [];
    const values = [];
    for (const key of ['code', 'type', 'name_ar', 'name_fr', 'name_en', 'price_cents', 'duration_days', 'sort']) {
      if (d[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(d[key]);
      }
    }
    if (d.active !== undefined) {
      fields.push('active = ?');
      values.push(d.active ? 1 : 0);
    }
    if (!fields.length) throw badRequest('nothing_to_update');
    values.push(boost.id);
    db.prepare(`UPDATE boost_products SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    audit(req, 'boost.updated', { entityType: 'boost', entityId: boost.id });
    res.json({ ok: true });
  }),
);

/* coupons */
router.get(
  '/coupons',
  requirePermission('coupons.manage'),
  asyncHandler(async (_req, res) => {
    res.json({ items: db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() });
  }),
);

router.post(
  '/coupons',
  requirePermission('coupons.manage'),
  asyncHandler(async (req, res) => {
    const d = validate(
      z.object({
        code: z.string().min(3).max(30).transform((v) => v.toUpperCase()),
        percent: z.coerce.number().int().min(0).max(100).default(0),
        amount_cents: z.coerce.number().int().min(0).default(0),
        max_uses: z.coerce.number().int().min(0).default(0),
        min_amount_cents: z.coerce.number().int().min(0).default(0),
        expires_at: z.coerce.number().int().optional(),
        active: z.boolean().default(true),
      }),
      req.body,
    );
    if (!d.percent && !d.amount_cents) throw badRequest('discount_required');
    if (db.prepare('SELECT 1 FROM coupons WHERE code = ?').get(d.code)) throw conflict('code_exists');
    const info = db
      .prepare(
        `INSERT INTO coupons (code, percent, amount_cents, max_uses, uses, min_amount_cents, expires_at, active, created_at)
         VALUES (?,?,?,?,0,?,?,?,?)`,
      )
      .run(d.code, d.percent, d.amount_cents, d.max_uses, d.min_amount_cents, d.expires_at ?? null, d.active ? 1 : 0, now());
    audit(req, 'coupon.created', { entityType: 'coupon', entityId: Number(info.lastInsertRowid), meta: { code: d.code } });
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }),
);

router.patch(
  '/coupons/:id',
  requirePermission('coupons.manage'),
  asyncHandler(async (req, res) => {
    const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(Number(req.params.id));
    if (!coupon) throw notFound('coupon_not_found');
    const d = validate(
      z.object({
        active: z.boolean().optional(),
        max_uses: z.coerce.number().int().min(0).optional(),
        expires_at: z.coerce.number().int().nullable().optional(),
      }),
      req.body,
    );
    if (d.active !== undefined) db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(d.active ? 1 : 0, coupon.id);
    if (d.max_uses !== undefined) db.prepare('UPDATE coupons SET max_uses = ? WHERE id = ?').run(d.max_uses, coupon.id);
    if (d.expires_at !== undefined) db.prepare('UPDATE coupons SET expires_at = ? WHERE id = ?').run(d.expires_at, coupon.id);
    audit(req, 'coupon.updated', { entityType: 'coupon', entityId: coupon.id });
    res.json({ ok: true });
  }),
);

router.delete(
  '/coupons/:id',
  requirePermission('coupons.manage'),
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM coupons WHERE id = ?').run(Number(req.params.id));
    audit(req, 'coupon.deleted', { entityType: 'coupon', entityId: Number(req.params.id) });
    res.json({ ok: true });
  }),
);

/* ============================== reports ============================== */

router.get(
  '/reports',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const where = ['1=1'];
    const params = {};
    if (req.query.status && req.query.status !== 'all') {
      where.push('r.status = @status');
      params.status = String(req.query.status);
    }
    const rows = db
      .prepare(
        `SELECT r.*, u.name AS reporter_name, u.email AS reporter_email, h.name AS handler_name
         FROM reports r LEFT JOIN users u ON u.id=r.reporter_id LEFT JOIN users h ON h.id=r.handled_by
         WHERE ${where.join(' AND ')} ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 100`,
      )
      .all(params);

    const enriched = rows.map((r) => {
      let target = null;
      if (r.target_type === 'listing') {
        target = db.prepare('SELECT id, public_id, title, status FROM listings WHERE id = ?').get(r.target_id);
      } else if (r.target_type === 'user') {
        target = db.prepare('SELECT id, name, status FROM users WHERE id = ?').get(r.target_id);
      } else if (r.target_type === 'store') {
        target = db.prepare('SELECT id, name, slug, status FROM stores WHERE id = ?').get(r.target_id);
      }
      return { ...r, target };
    });
    res.json({ items: enriched });
  }),
);

router.post(
  '/reports/:id',
  requirePermission('reports.handle'),
  asyncHandler(async (req, res) => {
    const d = validate(
      z.object({
        status: z.enum(['reviewing', 'resolved', 'dismissed']),
        note: text(0, 500).optional(),
        action: z.enum(['none', 'remove_listing', 'suspend_user', 'suspend_store']).default('none'),
      }),
      req.body,
    );
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(Number(req.params.id));
    if (!report) throw notFound('report_not_found');

    db.prepare('UPDATE reports SET status = ?, resolution_note = ?, handled_by = ?, updated_at = ? WHERE id = ?').run(
      d.status,
      d.note || null,
      req.user.id,
      now(),
      report.id,
    );

    if (d.action === 'remove_listing' && report.target_type === 'listing') {
      db.prepare("UPDATE listings SET status='deleted', updated_at=? WHERE id=?").run(now(), report.target_id);
    }
    if (d.action === 'suspend_user' && report.target_type === 'user' && req.user.role !== 'support') {
      db.prepare("UPDATE users SET status='suspended', status_reason=?, updated_at=? WHERE id=?").run(
        d.note || 'report',
        now(),
        report.target_id,
      );
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(report.target_id);
    }
    if (d.action === 'suspend_store' && report.target_type === 'store') {
      db.prepare("UPDATE stores SET status='suspended', status_reason=?, updated_at=? WHERE id=?").run(
        d.note || 'report',
        now(),
        report.target_id,
      );
    }
    if (report.reporter_id) {
      notify(report.reporter_id, {
        type: NOTIFICATION_TYPES.REPORT_UPDATE,
        titleKey: `notif.report_${d.status}`,
        body: d.note || '',
        link: '/account/reports',
      });
    }
    audit(req, 'report.handled', {
      entityType: 'report',
      entityId: report.id,
      meta: { status: d.status, action: d.action },
    });
    res.json({ ok: true });
  }),
);

/* ============================== categories / geo / content ============================== */

router.get(
  '/categories',
  requirePermission('platform.categories'),
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, p.name_ar AS parent_ar,
                (SELECT COUNT(*) FROM listings l WHERE l.category_id = c.id) AS listings_count
         FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
         ORDER BY COALESCE(c.parent_id, c.id), c.parent_id IS NOT NULL, c.sort, c.id`,
      )
      .all();
    res.json({ items: rows });
  }),
);

const categorySchema = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/).optional(),
  name_ar: text(2, 60),
  name_fr: text(2, 60),
  name_en: text(2, 60),
  icon: z.string().max(40).optional(),
  color: z.string().max(20).optional(),
  parent_id: z.coerce.number().int().positive().nullable().optional(),
  description_ar: text(0, 300).optional(),
  description_fr: text(0, 300).optional(),
  sort: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
});

router.post(
  '/categories',
  requirePermission('platform.categories'),
  asyncHandler(async (req, res) => {
    const d = validate(categorySchema, req.body);
    if (d.parent_id && !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(d.parent_id)) {
      throw badRequest('invalid_parent');
    }
    let slug = d.slug || slugify(d.name_en || d.name_fr || d.name_ar);
    let i = 1;
    while (db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(slug)) {
      slug = `${slug}-${i}`;
      i += 1;
    }
    if (d.parent_id) {
      const parent = db.prepare('SELECT parent_id FROM categories WHERE id = ?').get(d.parent_id);
      if (parent?.parent_id) throw badRequest('max_two_levels');
    }
    const info = db
      .prepare(
        `INSERT INTO categories (parent_id, slug, name_ar, name_fr, name_en, icon, color, description_ar, description_fr, sort, active, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        d.parent_id ?? null,
        slug,
        d.name_ar,
        d.name_fr,
        d.name_en,
        d.icon || null,
        d.color || null,
        d.description_ar || null,
        d.description_fr || null,
        d.sort ?? 0,
        1,
        now(),
      );
    audit(req, 'category.created', { entityType: 'category', entityId: Number(info.lastInsertRowid) });
    res.status(201).json({ id: Number(info.lastInsertRowid), slug });
  }),
);

router.patch(
  '/categories/:id',
  requirePermission('platform.categories'),
  asyncHandler(async (req, res) => {
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
    if (!cat) throw notFound('category_not_found');
    const d = validate(categorySchema.partial(), req.body);
    if (d.parent_id === cat.id) throw badRequest('invalid_parent');
    const fields = [];
    const values = [];
    for (const key of ['slug', 'name_ar', 'name_fr', 'name_en', 'icon', 'color', 'description_ar', 'description_fr', 'sort']) {
      if (d[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(d[key]);
      }
    }
    if (d.parent_id !== undefined) {
      fields.push('parent_id = ?');
      values.push(d.parent_id);
    }
    if (d.active !== undefined) {
      fields.push('active = ?');
      values.push(d.active ? 1 : 0);
    }
    if (!fields.length) throw badRequest('nothing_to_update');
    values.push(cat.id);
    db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    audit(req, 'category.updated', { entityType: 'category', entityId: cat.id });
    res.json({ ok: true });
  }),
);

router.delete(
  '/categories/:id',
  requirePermission('platform.categories'),
  asyncHandler(async (req, res) => {
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
    if (!cat) throw notFound('category_not_found');
    const inUse = db.prepare('SELECT COUNT(*) c FROM listings WHERE category_id = ?').get(cat.id).c;
    if (inUse > 0) {
      db.prepare('UPDATE categories SET active = 0 WHERE id = ?').run(cat.id);
      audit(req, 'category.deactivated_in_use', { entityType: 'category', entityId: cat.id });
      return res.json({ ok: true, deactivated: true, reason: 'category_in_use' });
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
    audit(req, 'category.deleted', { entityType: 'category', entityId: cat.id });
    res.json({ ok: true, deleted: true });
  }),
);

/* cities / areas */
router.get(
  '/cities',
  requirePermission('platform.geo'),
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM listings l WHERE l.city_id=c.id) AS listings_count,
                (SELECT COUNT(*) FROM areas a WHERE a.city_id=c.id) AS areas_count
         FROM cities c ORDER BY c.sort, c.name_ar`,
      )
      .all();
    res.json({ items: rows });
  }),
);

router.post(
  '/cities',
  requirePermission('platform.geo'),
  asyncHandler(async (req, res) => {
    const d = validate(
      z.object({
        name_ar: text(2, 60),
        name_fr: text(2, 60),
        name_en: text(2, 60),
        region: text(0, 60).optional(),
        lat: z.coerce.number().min(-90).max(90).nullable().optional(),
        lng: z.coerce.number().min(-180).max(180).nullable().optional(),
        active: z.boolean().default(true),
        sort: z.coerce.number().int().default(0),
      }),
      req.body,
    );
    let slug = slugify(d.name_en || d.name_fr);
    let i = 1;
    while (db.prepare('SELECT 1 FROM cities WHERE slug = ?').get(slug)) {
      slug = `${slugify(d.name_en || d.name_fr)}-${i}`;
      i += 1;
    }
    const info = db
      .prepare(
        'INSERT INTO cities (slug, name_ar, name_fr, name_en, region, lat, lng, active, sort) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .run(slug, d.name_ar, d.name_fr, d.name_en, d.region || null, d.lat ?? null, d.lng ?? null, d.active ? 1 : 0, d.sort);
    audit(req, 'city.created', { entityType: 'city', entityId: Number(info.lastInsertRowid) });
    res.status(201).json({ id: Number(info.lastInsertRowid), slug });
  }),
);

router.patch(
  '/cities/:id',
  requirePermission('platform.geo'),
  asyncHandler(async (req, res) => {
    const city = db.prepare('SELECT * FROM cities WHERE id = ?').get(Number(req.params.id));
    if (!city) throw notFound('city_not_found');
    const d = validate(
      z.object({
        name_ar: text(2, 60).optional(),
        name_fr: text(2, 60).optional(),
        name_en: text(2, 60).optional(),
        region: text(0, 60).optional(),
        active: z.boolean().optional(),
        sort: z.coerce.number().int().optional(),
      }),
      req.body,
    );
    const fields = [];
    const values = [];
    for (const key of ['name_ar', 'name_fr', 'name_en', 'region', 'sort']) {
      if (d[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(d[key]);
      }
    }
    if (d.active !== undefined) {
      fields.push('active = ?');
      values.push(d.active ? 1 : 0);
    }
    if (!fields.length) throw badRequest('nothing_to_update');
    values.push(city.id);
    db.prepare(`UPDATE cities SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    audit(req, 'city.updated', { entityType: 'city', entityId: city.id });
    res.json({ ok: true });
  }),
);

router.get(
  '/cities/:id/areas',
  requirePermission('platform.geo'),
  asyncHandler(async (req, res) => {
    res.json({
      items: db.prepare('SELECT * FROM areas WHERE city_id = ? ORDER BY name_ar').all(Number(req.params.id)),
    });
  }),
);

router.post(
  '/cities/:id/areas',
  requirePermission('platform.geo'),
  asyncHandler(async (req, res) => {
    const city = db.prepare('SELECT * FROM cities WHERE id = ?').get(Number(req.params.id));
    if (!city) throw notFound('city_not_found');
    const d = validate(
      z.object({ name_ar: text(2, 80), name_fr: text(2, 80).optional(), name_en: text(2, 80).optional() }),
      req.body,
    );
    const info = db
      .prepare('INSERT INTO areas (city_id, name_ar, name_fr, name_en, active) VALUES (?,?,?,?,1)')
      .run(city.id, d.name_ar, d.name_fr || d.name_ar, d.name_en || d.name_fr || d.name_ar);
    audit(req, 'area.created', { entityType: 'area', entityId: Number(info.lastInsertRowid) });
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }),
);

router.delete(
  '/areas/:id',
  requirePermission('platform.geo'),
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM areas WHERE id = ?').run(Number(req.params.id));
    audit(req, 'area.deleted', { entityType: 'area', entityId: Number(req.params.id) });
    res.json({ ok: true });
  }),
);

/* pages / faqs / settings / notifications */
router.get(
  '/pages',
  requirePermission('platform.content'),
  asyncHandler(async (_req, res) => {
    res.json({ items: db.prepare('SELECT * FROM pages ORDER BY slug').all() });
  }),
);

router.put(
  '/pages/:slug',
  requirePermission('platform.content'),
  asyncHandler(async (req, res) => {
    const d = validate(
      z.object({
        title_ar: text(2, 120),
        title_fr: text(2, 120),
        title_en: text(2, 120),
        body_ar: text(0, 20000).optional(),
        body_fr: text(0, 20000).optional(),
        body_en: text(0, 20000).optional(),
        published: z.boolean().default(true),
      }),
      req.body,
    );
    const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(req.params.slug);
    if (existing) {
      db.prepare(
        `UPDATE pages SET title_ar=?, title_fr=?, title_en=?, body_ar=?, body_fr=?, body_en=?, published=?, updated_at=? WHERE slug=?`,
      ).run(d.title_ar, d.title_fr, d.title_en, d.body_ar || '', d.body_fr || '', d.body_en || '', d.published ? 1 : 0, now(), req.params.slug);
    } else {
      db.prepare(
        `INSERT INTO pages (slug, title_ar, title_fr, title_en, body_ar, body_fr, body_en, published, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(req.params.slug, d.title_ar, d.title_fr, d.title_en, d.body_ar || '', d.body_fr || '', d.body_en || '', d.published ? 1 : 0, now());
    }
    audit(req, 'page.updated', { entityType: 'page', meta: { slug: req.params.slug } });
    res.json({ ok: true });
  }),
);

router.get(
  '/faqs',
  requirePermission('platform.content'),
  asyncHandler(async (_req, res) => res.json({ items: db.prepare('SELECT * FROM faqs ORDER BY sort, id').all() })),
);

router.post(
  '/faqs',
  requirePermission('platform.content'),
  asyncHandler(async (req, res) => {
    const d = validate(
      z.object({
        q_ar: text(3, 300),
        a_ar: text(3, 3000),
        q_fr: text(0, 300).optional(),
        a_fr: text(0, 3000).optional(),
        q_en: text(0, 300).optional(),
        a_en: text(0, 3000).optional(),
        sort: z.coerce.number().int().default(0),
      }),
      req.body,
    );
    const info = db
      .prepare('INSERT INTO faqs (q_ar, a_ar, q_fr, a_fr, q_en, a_en, sort, published) VALUES (?,?,?,?,?,?,?,1)')
      .run(d.q_ar, d.a_ar, d.q_fr || null, d.a_fr || null, d.q_en || null, d.a_en || null, d.sort);
    audit(req, 'faq.created', { entityType: 'faq', entityId: Number(info.lastInsertRowid) });
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }),
);

router.delete(
  '/faqs/:id',
  requirePermission('platform.content'),
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM faqs WHERE id = ?').run(Number(req.params.id));
    audit(req, 'faq.deleted', { entityType: 'faq', entityId: Number(req.params.id) });
    res.json({ ok: true });
  }),
);

router.get(
  '/settings',
  requirePermission('platform.settings'),
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT key, value, updated_at FROM settings ORDER BY key').all();
    const stored = Object.fromEntries(rows.map((r) => [r.key, fromJson(r.value, r.value)]));
    const types = Object.fromEntries(Object.entries(SETTING_DEFAULTS).map(([k, v]) => [k, typeof v]));
    res.json({
      items: rows.map((r) => ({ ...r, value: fromJson(r.value, r.value) })),
      types,
      effective: getSettings(),
      defaults: SETTING_DEFAULTS,
      known_keys: Object.keys(SETTING_DEFAULTS),
      override_keys: Object.keys(stored),
    });
  }),
);

router.put(
  '/settings/:key',
  requirePermission('platform.settings'),
  asyncHandler(async (req, res) => {
    const key = String(req.params.key).slice(0, 60);
    if (!(key in SETTING_DEFAULTS)) throw badRequest('unknown_setting_key');
    const value = req.body?.value;
    if (value === undefined) throw badRequest('value_required');
    const fallback = SETTING_DEFAULTS[key];
    if (typeof fallback === 'boolean' && typeof value !== 'boolean') throw badRequest('invalid_setting_type');
    if (typeof fallback === 'number' && !Number.isFinite(Number(value))) throw badRequest('invalid_setting_type');
    saveSetting(key, typeof fallback === 'number' ? Number(value) : value);
    audit(req, 'setting.updated', { meta: { key, value } });
    res.json({ ok: true, effective: getSettings() });
  }),
);

router.delete(
  '/settings/:key',
  requirePermission('platform.settings'),
  asyncHandler(async (req, res) => {
    const key = String(req.params.key).slice(0, 60);
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    invalidateSettings();
    audit(req, 'setting.reset', { meta: { key } });
    res.json({ ok: true });
  }),
);

router.post(
  '/notifications/broadcast',
  requirePermission('platform.notifications'),
  asyncHandler(async (req, res) => {
    const d = validate(
      z.object({
        title_key: z.string().max(60).default('notif.system'),
        body: text(3, 500),
        link: z.string().max(200).optional(),
        user_ids: z.array(z.coerce.number().int().positive()).max(500).optional(),
        role: z.enum(ROLES).optional(),
      }),
      req.body,
    );
    let targets = d.user_ids;
    if (!targets) {
      const rows = d.role
        ? db.prepare('SELECT id FROM users WHERE role = ? AND status = ?').all(d.role, 'active')
        : db.prepare("SELECT id FROM users WHERE status = 'active'").all();
      targets = rows.map((r) => r.id);
    }
    const ts = now();
    const insert = db.prepare(
      'INSERT INTO notifications (user_id, type, title_key, body, link, created_at) VALUES (?,?,?,?,?,?)',
    );
    db.transaction(() => {
      for (const id of targets) insert.run(id, 'system', d.title_key, d.body, d.link || null, ts);
    })();
    audit(req, 'notification.broadcast', { meta: { count: targets.length } });
    res.json({ ok: true, sent: targets.length });
  }),
);

/* ============================== staff & audit ============================== */

router.get(
  '/staff',
  requirePermission('staff.manage'),
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(
        `SELECT id, name, email, role, status, created_at, last_seen_at FROM users
         WHERE role != 'user' ORDER BY CASE role WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, name`,
      )
      .all();
    const perms = db.prepare('SELECT user_id, permission FROM user_permissions').all();
    res.json({
      items: rows.map((r) => ({
        ...r,
        extra_permissions: perms.filter((p) => p.user_id === r.id).map((p) => p.permission),
      })),
    });
  }),
);

router.get(
  '/audit',
  requirePermission('audit.view'),
  asyncHandler(async (req, res) => {
    const where = ['1=1'];
    const params = {};
    if (req.query.action) {
      where.push('a.action LIKE @action');
      params.action = `%${String(req.query.action).slice(0, 40)}%`;
    }
    if (req.query.actor) {
      where.push('a.actor_id = @actor');
      params.actor = Number(req.query.actor);
    }
    params.limit = Math.min(200, Number(req.query.limit) || 100);
    const rows = db
      .prepare(
        `SELECT a.*, u.name AS actor_name, u.role AS actor_role FROM audit_log a
         LEFT JOIN users u ON u.id = a.actor_id WHERE ${where.join(' AND ')}
         ORDER BY a.id DESC LIMIT @limit`,
      )
      .all(params);
    res.json({ items: rows });
  }),
);

/* ============================== contact inbox ============================== */

router.get(
  '/inbox',
  requirePermission('platform.content'),
  asyncHandler(async (req, res) => {
    const where = ['1=1'];
    const params = {};
    if (req.query.status && req.query.status !== 'all') {
      where.push('status = @status');
      params.status = String(req.query.status);
    }
    if (req.query.q) {
      where.push('(name LIKE @q OR email LIKE @q OR subject LIKE @q OR message LIKE @q)');
      params.q = `%${String(req.query.q).slice(0, 60)}%`;
    }
    params.limit = Math.min(200, Number(req.query.limit) || 60);
    const items = db
      .prepare(
        `SELECT * FROM contact_messages WHERE ${where.join(' AND ')}
         ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'open' THEN 1 ELSE 2 END, created_at DESC
         LIMIT @limit`,
      )
      .all(params);
    const counts = db.prepare('SELECT status, COUNT(*) c FROM contact_messages GROUP BY status').all();
    res.json({
      items,
      counts: Object.fromEntries(counts.map((r) => [r.status, r.c])),
      unread: counts.find((r) => r.status === 'new')?.c || 0,
    });
  }),
);

router.put(
  '/inbox/:id',
  requirePermission('platform.content'),
  asyncHandler(async (req, res) => {
    const d = validate(
      z.object({ status: z.enum(['new', 'open', 'answered', 'closed', 'spam']), note: text(0, 2000).optional() }),
      req.body,
    );
    const msg = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(Number(req.params.id));
    if (!msg) throw notFound('message_not_found');
    db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(d.status, msg.id);
    if (d.note) {
      const reply = `\n\n--- رد الإدارة / Réponse (${new Date().toISOString().slice(0, 16).replace('T', ' ')})\n${d.note}`;
      db.prepare('UPDATE contact_messages SET message = message || ? WHERE id = ?').run(reply, msg.id);
      await sendMail({ to: msg.email, subject: `Re: ${msg.subject || 'Bii3 & Chri Online'}`, text: d.note }).catch((err) =>
        logger.warn({ err }, 'contact reply mail failed'),
      );
      audit(req, 'contact.replied', { entityType: 'contact_message', entityId: msg.id });
    } else {
      audit(req, 'contact.status_changed', { entityType: 'contact_message', entityId: msg.id, meta: { status: d.status } });
    }
    res.json({ ok: true });
  }),
);

router.delete(
  '/inbox/:id',
  requirePermission('platform.content'),
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM contact_messages WHERE id = ?').run(Number(req.params.id));
    audit(req, 'contact.deleted', { entityType: 'contact_message', entityId: Number(req.params.id) });
    res.json({ ok: true });
  }),
);

/* ============================== search analytics ============================== */

router.get(
  '/search-analytics',
  requirePermission('platform.content'),
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Number(req.query.days) || 30);
    const since = now() - days * 864e5;
    const top = db
      .prepare(
        `SELECT query, COUNT(*) hits, ROUND(AVG(results), 1) avg_results, MAX(created_at) last_seen
         FROM search_queries WHERE created_at >= ?
         GROUP BY lower(trim(query)) ORDER BY hits DESC LIMIT 50`,
      )
      .all(since);
    const empty = db
      .prepare(
        `SELECT query, COUNT(*) hits, MAX(created_at) last_seen FROM search_queries
         WHERE created_at >= ? AND results = 0
         GROUP BY lower(trim(query)) ORDER BY hits DESC LIMIT 30`,
      )
      .all(since);
    const totals = db
      .prepare(
        `SELECT COUNT(*) searches, COALESCE(SUM(CASE WHEN results = 0 THEN 1 ELSE 0 END), 0) empty_results,
                COALESCE(SUM(results), 0) result_sum
         FROM search_queries WHERE created_at >= ?`,
      )
      .get(since);
    const daily = db
      .prepare(
        `SELECT date(created_at / 1000, 'unixepoch') day, COUNT(*) searches
         FROM search_queries WHERE created_at >= ? GROUP BY day ORDER BY day DESC LIMIT 30`,
      )
      .all(since);
    res.json({ days, top, empty, totals, daily: daily.reverse() });
  }),
);

/* ============================== payment webhooks log ============================== */

router.get(
  '/webhooks',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const items = db
      .prepare('SELECT * FROM payment_webhooks ORDER BY id DESC LIMIT ?')
      .all(Math.min(200, Number(req.query.limit) || 60));
    const stats = db
      .prepare(
        `SELECT COUNT(*) total,
                COALESCE(SUM(signature_ok), 0) valid_signature,
                COALESCE(SUM(processed), 0) processed,
                COALESCE(SUM(CASE WHEN signature_ok = 0 THEN 1 ELSE 0 END), 0) rejected
         FROM payment_webhooks`,
      )
      .get();
    res.json({ items, stats });
  }),
);

/* ============================== SEO overview ============================== */

router.get(
  '/seo',
  requirePermission('platform.content'),
  asyncHandler(async (_req, res) => {
    const active = db.prepare("SELECT COUNT(*) c FROM listings WHERE status='active'").get().c;
    const stores = db.prepare("SELECT COUNT(*) c FROM stores WHERE status='active'").get().c;
    const categories = db.prepare('SELECT COUNT(*) c FROM categories WHERE active = 1').get().c;
    const pages = db.prepare('SELECT COUNT(*) c FROM pages WHERE published = 1').get().c;
    const missingDescriptions = db
      .prepare("SELECT COUNT(*) c FROM listings WHERE status='active' AND (description IS NULL OR length(description) < 60)")
      .get().c;
    const missingImages = db
      .prepare(
        `SELECT COUNT(*) c FROM listings l WHERE l.status='active'
         AND NOT EXISTS (SELECT 1 FROM listing_images i WHERE i.listing_id = l.id)`,
      )
      .get().c;
    const lastListing = db.prepare("SELECT MAX(updated_at) t FROM listings WHERE status='active'").get().t;
    res.json({
      urls: { listings: active, stores, categories, pages, total: active + stores + categories + pages + 9 },
      health: { missing_descriptions: missingDescriptions, missing_images: missingImages },
      last_listing_update: lastListing,
      sitemap_url: '/sitemap.xml',
      robots_url: '/robots.txt',
    });
  }),
);

export default router;
