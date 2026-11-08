import { Router } from 'express';
import { db, now } from '../lib/db.js';
import { config } from '../config.js';
import {
  hashPassword,
  verifyPassword,
  passwordIssues,
  randomToken,
  randomCode,
  sha256,
  signSession,
  normalizeEmail,
  normalizePhone,
  clientIp,
  cleanText,
  maskEmail,
  csrfTokenFor,
  CSRF_COOKIE,
} from '../lib/security.js';
import { authAvatar } from '../lib/storage.js';
import { getSettings } from '../lib/settings.js';
import { z, validate, emailSchema, phoneSchema, text } from '../lib/validation.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors.js';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, serializeUser, loadUser } from '../lib/auth.js';
import { limiters } from '../lib/http.js';
import { activity, audit } from '../lib/audit.js';
import { notify, NOTIFICATION_TYPES } from '../lib/notify.js';
import { sendMail } from '../lib/mailer.js';
import { publish } from '../lib/realtime.js';

const router = Router();

const SESSION_MS = config.security.sessionDays * 864e5;

/**
 * Issues a fresh CSRF token bound to the (new) session id and syncs the
 * double-submit cookie. Called after every login/register/logout so the
 * client never keeps a token bound to a dead session.
 */
function issueCsrf(res, sessionId) {
  const token = csrfTokenFor(sessionId || 'anon');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: config.security.cookieSecure,
    maxAge: sessionId ? SESSION_MS : 864e5,
    path: '/',
  });
  return token;
}

function createSession(userId, req, res) {
  const id = randomToken(24);
  const ts = now();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, created_at, last_used_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, sha256(id), clientIp(req), String(req.get('user-agent') || '').slice(0, 300), ts, ts, ts + SESSION_MS);

  res.cookie(config.security.cookieName, signSession(id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.security.cookieSecure,
    maxAge: SESSION_MS,
    path: '/',
  });
  issueCsrf(res, id);
  return id;
}

function destroySession(req, res) {
  if (req.session) db.prepare('DELETE FROM sessions WHERE id = ?').run(req.session.id);
  res.clearCookie(config.security.cookieName, { path: '/' });
  issueCsrf(res, null);
}

function findByEmailOrPhone(identifier) {
  const email = normalizeEmail(identifier);
  if (email) return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const phone = normalizePhone(identifier);
  if (phone) return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  return null;
}

/* ---------------------------- register ---------------------------- */

const registerSchema = z
  .object({
    name: text(2, 60),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: z.string().min(8).max(200),
    city_id: z.coerce.number().int().positive().optional(),
    locale: z.enum(['ar', 'fr', 'en']).default('ar'),
    accept_terms: z.literal(true),
  })
  .refine((d) => d.email || d.phone, { message: 'email_or_phone_required', path: ['email'] });

router.post(
  '/register',
  limiters.register,
  asyncHandler(async (req, res) => {
    if (!getSettings().signup_enabled) throw forbidden('signup_disabled');
    const data = validate(registerSchema, req.body);
    const issues = passwordIssues(data.password);
    if (issues.length) throw badRequest('weak_password', { password: issues.join(',') });

    if (data.email && db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email)) {
      throw conflict('email_already_registered');
    }
    if (data.phone && db.prepare('SELECT 1 FROM users WHERE phone = ?').get(data.phone)) {
      throw conflict('phone_already_registered');
    }
    if (data.city_id && !db.prepare('SELECT 1 FROM cities WHERE id = ? AND active = 1').get(data.city_id)) {
      throw badRequest('invalid_city');
    }

    const ts = now();
    const info = db
      .prepare(
        `INSERT INTO users (email, phone, password_hash, name, city_id, locale, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.email || null,
        data.phone || null,
        hashPassword(data.password),
        data.name,
        data.city_id || null,
        data.locale,
        ts,
        ts,
        ts,
      );

    const userId = Number(info.lastInsertRowid);
    createSession(userId, req, res);
    activity(userId, 'account.created', { ip: clientIp(req) });
    notify(userId, {
      type: NOTIFICATION_TYPES.ACCOUNT_UPDATE,
      titleKey: 'notif.welcome',
      link: '/post',
    });

    const user = loadUser(userId);
    res.status(201).json({
      user: serializeUser(user, { self: true }),
      csrfToken: csrfTokenFor(db.prepare("SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId).id),
    });
  }),
);

/* ---------------------------- login / logout ---------------------------- */

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(190),
  password: z.string().min(1).max(200),
});

router.post(
  '/login',
  limiters.login,
  asyncHandler(async (req, res) => {
    const { identifier, password } = validate(loginSchema, req.body);
    const user = findByEmailOrPhone(identifier);

    // Constant-ish time: always run a hash comparison.
    const dummy = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA';
    const ok = user ? verifyPassword(password, user.password_hash) : verifyPassword(password, dummy);

    if (!user || !ok) {
      activity(user?.id ?? null, 'auth.login_failed', { ip: clientIp(req), meta: { identifier: maskEmail(identifier) } });
      throw unauthorized('invalid_credentials');
    }
    if (user.status === 'banned') throw forbidden('account_banned');
    if (user.status === 'suspended') throw forbidden('account_suspended');

    createSession(user.id, req, res);
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), user.id);
    activity(user.id, 'auth.login', { ip: clientIp(req) });

    const fresh = loadUser(user.id);
    const newest = db.prepare('SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(user.id);
    res.json({ user: serializeUser(fresh, { self: true }), csrfToken: csrfTokenFor(newest.id) });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.user) activity(req.user.id, 'auth.logout', { ip: clientIp(req) });
    destroySession(req, res);
    res.json({ ok: true, csrfToken: csrfTokenFor('anon') });
  }),
);

router.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
    res.clearCookie(config.security.cookieName, { path: '/' });
    audit(req, 'auth.logout_all', { entityType: 'user', entityId: req.user.id });
    issueCsrf(res, null);
    res.json({ ok: true, csrfToken: csrfTokenFor('anon') });
  }),
);

/* ---------------------------- password reset ---------------------------- */

router.post(
  '/forgot-password',
  limiters.otp,
  asyncHandler(async (req, res) => {
    const { identifier } = validate(z.object({ identifier: z.string().trim().min(3).max(190) }), req.body);
    const user = findByEmailOrPhone(identifier);
    // Always respond 200 to avoid account enumeration.
    if (user && user.email) {
      const token = randomToken(32);
      const ts = now();
      db.prepare(
        'INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
      ).run(user.id, sha256(token), ts + 60 * 60 * 1000, ts);
      const link = `${config.appUrl}/reset-password?token=${token}`;
      const result = await sendMail({
        to: user.email,
        subject: 'إعادة تعيين كلمة المرور — بيع وشري أونلاين',
        text: `مرحباً ${user.name},\n\nلإعادة تعيين كلمة المرور استعمل الرابط التالي (صالح لمدة ساعة):\n${link}\n\nBii3 & Chri Online`,
      });
      if (result?.skipped && !config.isProd) {
        return res.json({ ok: true, dev_reset_token: token });
      }
    }
    res.json({ ok: true });
  }),
);

router.post(
  '/reset-password',
  limiters.otp,
  asyncHandler(async (req, res) => {
    const { token, password } = validate(
      z.object({ token: z.string().min(10).max(300), password: z.string().min(8).max(200) }),
      req.body,
    );
    const issues = passwordIssues(password);
    if (issues.length) throw badRequest('weak_password', { password: issues.join(',') });

    const row = db
      .prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL')
      .get(sha256(token));
    if (!row || row.expires_at < now()) throw badRequest('reset_token_invalid');

    const ts = now();
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?').run(
        hashPassword(password),
        ts,
        row.user_id,
      );
      db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(ts, row.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    })();

    activity(row.user_id, 'account.password_reset', { ip: clientIp(req) });
    notify(row.user_id, {
      type: NOTIFICATION_TYPES.ACCOUNT_UPDATE,
      titleKey: 'notif.password_changed',
      link: '/account',
    });
    res.json({ ok: true });
  }),
);

router.post(
  '/change-password',
  requireAuth,
  limiters.otp,
  asyncHandler(async (req, res) => {
    const { current_password, password } = validate(
      z.object({ current_password: z.string().min(1), password: z.string().min(8).max(200) }),
      req.body,
    );
    if (!verifyPassword(current_password, req.user.password_hash)) throw unauthorized('current_password_wrong');
    const issues = passwordIssues(password);
    if (issues.length) throw badRequest('weak_password', { password: issues.join(',') });

    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        hashPassword(password),
        now(),
        req.user.id,
      );
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.session.id);
    })();
    activity(req.user.id, 'account.password_changed', { ip: clientIp(req) });
    res.json({ ok: true });
  }),
);

/* ---------------------------- OTP ---------------------------- */

router.post(
  '/otp/request',
  requireAuth,
  limiters.otp,
  asyncHandler(async (req, res) => {
    const { purpose } = validate(z.object({ purpose: z.enum(['phone', 'email']).default('phone') }), req.body);
    const target = purpose === 'phone' ? req.user.phone : req.user.email;
    if (!target) throw badRequest(`no_${purpose}_on_account`);

    const code = randomCode(6);
    const ts = now();
    db.prepare('DELETE FROM otp_codes WHERE user_id = ? AND purpose = ?').run(req.user.id, purpose);
    db.prepare(
      `INSERT INTO otp_codes (user_id, purpose, target, code_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(req.user.id, purpose, target, sha256(code), ts + 10 * 60 * 1000, ts);

    const { sendSms } = await import('../lib/mailer.js');
    if (purpose === 'phone') {
      await sendSms(target, `Bii3 & Chri: رمز التحقق ${code}`);
    } else {
      await sendMail({ to: target, subject: 'رمز التحقق — بيع وشري', text: `رمز التحقق: ${code}` });
    }
    const dev = !config.sms.enabled && !config.isProd ? { dev_code: code } : {};
    res.json({ ok: true, purpose, ...dev });
  }),
);

router.post(
  '/otp/verify',
  requireAuth,
  limiters.otp,
  asyncHandler(async (req, res) => {
    const { purpose, code } = validate(
      z.object({ purpose: z.enum(['phone', 'email']).default('phone'), code: z.string().regex(/^\d{6}$/) }),
      req.body,
    );
    const row = db
      .prepare('SELECT * FROM otp_codes WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1')
      .get(req.user.id, purpose);
    if (!row) throw badRequest('no_pending_code');
    if (row.expires_at < now()) throw badRequest('code_expired');
    if (row.attempts >= 5) throw badRequest('too_many_attempts');

    if (row.code_hash !== sha256(code)) {
      db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
      throw badRequest('invalid_code');
    }
    const ts = now();
    db.transaction(() => {
      db.prepare('UPDATE otp_codes SET consumed_at = ? WHERE id = ?').run(ts, row.id);
      db.prepare(
        `UPDATE users SET ${purpose === 'phone' ? 'phone_verified' : 'email_verified'} = 1, updated_at = ? WHERE id = ?`,
      ).run(ts, req.user.id);
    })();
    const user = loadUser(req.user.id);
    res.json({ ok: true, user: serializeUser(user, { self: true }) });
  }),
);

/* ---------------------------- account & profile ---------------------------- */

const profileSchema = z.object({
  name: text(2, 60).optional(),
  bio: text(0, 500).optional(),
  city_id: z.coerce.number().int().positive().nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  avatar: z.string().max(300).nullable().optional(),
  locale: z.enum(['ar', 'fr', 'en']).optional(),
  show_phone: z.boolean().optional(),
  show_last_seen: z.boolean().optional(),
  allow_messages: z.boolean().optional(),
});

router.patch(
  '/me',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const data = validate(profileSchema, req.body);
    const current = req.user;

    if (data.phone && data.phone !== current.phone) {
      const exists = db.prepare('SELECT 1 FROM users WHERE phone = ? AND id != ?').get(data.phone, current.id);
      if (exists) throw conflict('phone_already_registered');
    }
    if (data.city_id && !db.prepare('SELECT 1 FROM cities WHERE id = ?').get(data.city_id)) {
      throw badRequest('invalid_city');
    }
    if (data.avatar && data.avatar.startsWith('data:')) {
      const saved = await authAvatar(data.avatar, current.id);
      data.avatar = saved;
    }

    const fields = [];
    const values = [];
    for (const key of ['name', 'bio', 'city_id', 'phone', 'avatar', 'locale', 'show_phone', 'show_last_seen', 'allow_messages']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(typeof data[key] === 'boolean' ? (data[key] ? 1 : 0) : data[key]);
      }
    }
    if (data.phone !== undefined) {
      fields.push('phone_verified = 0');
    }
    if (!fields.length) return res.json({ user: serializeUser(current, { self: true }) });

    fields.push('updated_at = ?');
    values.push(now(), current.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    activity(current.id, 'account.profile_updated', { ip: clientIp(req) });
    res.json({ user: serializeUser(loadUser(current.id), { self: true }) });
  }),
);

router.post(
  '/me/email',
  requireAuth,
  limiters.otp,
  asyncHandler(async (req, res) => {
    const { email } = validate(z.object({ email: emailSchema }), req.body);
    if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, req.user.id)) {
      throw conflict('email_already_registered');
    }
    db.prepare('UPDATE users SET email = ?, email_verified = 0, updated_at = ? WHERE id = ?').run(email, now(), req.user.id);
    res.json({ user: serializeUser(loadUser(req.user.id), { self: true }) });
  }),
);

router.get(
  '/me/activity',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare('SELECT action, meta, ip, created_at FROM activity_log WHERE user_id = ? ORDER BY id DESC LIMIT 100')
      .all(req.user.id);
    res.json({ items: rows });
  }),
);

router.get(
  '/me/export',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = serializeUser(req.user, { self: true });
    const listings = db
      .prepare('SELECT public_id, title, price_cents, status, created_at FROM listings WHERE user_id = ?')
      .all(req.user.id);
    const reviews = db
      .prepare('SELECT rating, comment, created_at FROM reviews WHERE target_type = ? AND target_id = ?')
      .all('user', req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename="bii3chri-account-${req.user.id}.json"`);
    res.json({ exported_at: new Date().toISOString(), user, listings, reviews });
  }),
);

router.delete(
  '/me',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const { password } = validate(z.object({ password: z.string().min(1) }), req.body);
    if (!verifyPassword(password, req.user.password_hash)) throw unauthorized('current_password_wrong');

    const ts = now();
    db.transaction(() => {
      // Anonymize personal data, keep transactional integrity for other users.
      db.prepare(
        `UPDATE users SET
           email = NULL, phone = NULL, name = 'مستخدم محذوف', bio = NULL, avatar = NULL,
           status = 'banned', status_reason = 'self_deleted', password_hash = ?, updated_at = ?
         WHERE id = ?`,
      ).run(hashPassword(randomToken(24)), ts, req.user.id);
      db.prepare("UPDATE listings SET status='deleted', updated_at=? WHERE user_id = ?").run(ts, req.user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
      db.prepare('DELETE FROM favorites WHERE user_id = ?').run(req.user.id);
    })();
    audit(req, 'account.deleted', { entityType: 'user', entityId: req.user.id });
    res.clearCookie(config.security.cookieName, { path: '/' });
    issueCsrf(res, null);
    res.json({ ok: true, csrfToken: csrfTokenFor('anon') });
  }),
);

/* ---------------------------- public profile ---------------------------- */

router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw notFound();
    const user = loadUser(id);
    if (!user || user.status === 'banned') throw notFound('user_not_found');

    const listings = db
      .prepare(
        `SELECT l.public_id, l.title, l.price_cents, l.currency, l.city_id, l.created_at, l.views_count,
                (SELECT path FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, position LIMIT 1) AS image,
                c.name_ar AS cat_ar, c.name_fr AS cat_fr, c.name_en AS cat_en, c.slug AS cat_slug,
                ci.name_ar AS city_ar, ci.name_fr AS city_fr, ci.name_en AS city_en, ci.slug AS city_slug
         FROM listings l
         JOIN categories c ON c.id = l.category_id
         JOIN cities ci ON ci.id = l.city_id
         WHERE l.user_id = ? AND l.status = 'active'
         ORDER BY l.created_at DESC LIMIT 24`,
      )
      .all(id);

    const reviews = db
      .prepare(
        `SELECT r.rating, r.comment, r.created_at, r.verified, u.name AS reviewer_name, u.avatar AS reviewer_avatar
         FROM reviews r JOIN users u ON u.id = r.reviewer_id
         WHERE r.target_type = 'user' AND r.target_id = ? AND r.status = 'visible'
         ORDER BY r.created_at DESC LIMIT 20`,
      )
      .all(id);

    const store = db.prepare('SELECT * FROM stores WHERE user_id = ? AND status = ?').get(id, 'active');
    res.json({
      user: serializeUser(user),
      phone: user.show_phone ? user.phone : null,
      store: store || null,
      listings,
      reviews,
      stats: {
        active_listings: db.prepare("SELECT COUNT(*) c FROM listings WHERE user_id = ? AND status='active'").get(id).c,
        sold: db.prepare("SELECT COUNT(*) c FROM listings WHERE user_id = ? AND status='sold'").get(id).c,
        followers: store ? store.followers_count : 0,
        member_since: user.created_at,
      },
    });
  }),
);

export default router;
