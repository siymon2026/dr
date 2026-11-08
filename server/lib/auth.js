import { db, now } from './db.js';
import { config } from '../config.js';
import { parseSessionToken, csrfTokenFor, CSRF_COOKIE } from './security.js';
import { forbidden, unauthorized } from './errors.js';
import { can, isStaff, permissionsFor } from './permissions.js';

const getUserById = db.prepare(`
  SELECT u.*, c.name_ar AS city_name_ar, c.name_fr AS city_name_fr, c.name_en AS city_name_en, c.slug AS city_slug
  FROM users u LEFT JOIN cities c ON c.id = u.city_id WHERE u.id = ?
`);

export function loadUser(userId) {
  const user = getUserById.get(userId);
  if (!user) return null;
  const extra = db.prepare('SELECT permission FROM user_permissions WHERE user_id = ?').all(userId);
  user.extra_permissions = extra.map((r) => r.permission);
  return user;
}

function touchSession(session) {
  // throttle writes: at most once per 5 minutes
  if (now() - session.last_used_at > 5 * 60 * 1000) {
    db.prepare('UPDATE sessions SET last_used_at = ? WHERE id = ?').run(now(), session.id);
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), session.user_id);
  }
}

const getSession = db.prepare('SELECT * FROM sessions WHERE id = ?');

/** Attach req.user / req.session if a valid signed session cookie is present. */
export function attachUser(req, _res, next) {
  req.user = null;
  req.session = null;
  const raw = req.cookies?.[config.security.cookieName];
  if (!raw) return next();
  const sessionId = parseSessionToken(raw);
  if (!sessionId) return next();
  const session = getSession.get(sessionId);
  if (!session) return next();
  if (session.expires_at < now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    return next();
  }
  const user = loadUser(session.user_id);
  if (!user) return next();
  if (user.status === 'banned' || user.status === 'suspended') {
    req.inactiveUser = user;
    return next();
  }
  touchSession(session);
  req.session = session;
  req.user = user;
  req.csrfBinding = session.id;
  req.csrfToken = csrfTokenFor(session.id);
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) {
    if (req.inactiveUser) return next(forbidden('account_disabled'));
    return next(unauthorized());
  }
  next();
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!can(req.user, permission)) return next(forbidden());
    next();
  };
}

export function requireStaff(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (!isStaff(req.user)) return next(forbidden());
  next();
}

/** Ensure the request has a CSRF cookie set; value is bound to the session. */
export function ensureCsrfCookie(req, res) {
  const binding = req.session?.id || 'anon';
  const token = csrfTokenFor(binding);
  if (req.cookies?.[CSRF_COOKIE] !== token) {
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: config.security.cookieSecure,
      maxAge: config.security.sessionDays * 864e5,
      path: '/',
    });
  }
  return token;
}

export function serializeUser(user, { self = false } = {}) {
  if (!user) return null;
  const base = {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
    is_store: !!user.is_store,
    verified_seller: !!user.verified_seller,
    rating_avg: user.rating_avg,
    rating_count: user.rating_count,
    listings_count: user.listings_count,
    city: user.city_id
      ? { id: user.city_id, slug: user.city_slug, name: { ar: user.city_name_ar, fr: user.city_name_fr, en: user.city_name_en } }
      : null,
    created_at: user.created_at,
    last_seen_at: user.show_last_seen || self ? user.last_seen_at : null,
    show_last_seen: !!user.show_last_seen,
    status: user.status,
  };
  if (!self) {
    base.bio = user.bio;
    base.permissions = isStaff(user) ? [] : undefined;
    return base;
  }
  return {
    ...base,
    email: user.email,
    phone: user.phone,
    bio: user.bio,
    email_verified: !!user.email_verified,
    phone_verified: !!user.phone_verified,
    show_phone: !!user.show_phone,
    show_last_seen: !!user.show_last_seen,
    allow_messages: !!user.allow_messages,
    locale: user.locale,
    city_id: user.city_id,
    status_reason: user.status_reason,
    permissions: [...permissionsFor(user)],
    extra_permissions: user.extra_permissions || [],
  };
}
