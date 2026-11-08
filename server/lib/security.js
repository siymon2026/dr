import crypto from 'node:crypto';
import { config } from '../config.js';

const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEYLEN = 64;

/* ---------------- passwords ---------------- */

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_r}$${SCRYPT_p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [algo, n, r, p, saltB64, hashB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(String(password), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function passwordIssues(password) {
  const issues = [];
  if (typeof password !== 'string' || password.length < 8) issues.push('min_length');
  if (!/[A-Za-z\u0600-\u06FF]/.test(password || '')) issues.push('needs_letter');
  if (!/[0-9]/.test(password || '')) issues.push('needs_number');
  return issues;
}

/* ---------------- tokens & hashes ---------------- */

export const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const randomCode = (digits = 6) =>
  String(crypto.randomInt(0, 10 ** digits)).padStart(digits, '0');

export function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/* ---------------- sessions (HMAC-signed opaque tokens) ---------------- */

const secret = () => config.security.jwtSecret || 'dev-only-insecure-secret-change-me';

export function signSession(sessionId) {
  const payload = sessionId;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseSessionToken(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const idx = raw.lastIndexOf('.');
  if (idx <= 0) return null;
  const payload = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  if (!timingSafeEqualStr(sig, expected)) return null;
  return payload;
}

/* ---------------- CSRF (double-submit, HMAC-bound to session) ---------------- */

export const CSRF_COOKIE = 'bc_csrf';

export function csrfTokenFor(binding) {
  const mac = crypto.createHmac('sha256', secret()).update(`csrf:${binding}`).digest('base64url');
  return mac.slice(0, 32);
}

export function verifyCsrf(binding, token) {
  if (!token) return false;
  return timingSafeEqualStr(csrfTokenFor(binding), String(token));
}

/* ---------------- text sanitization ---------------- */

/** Escape HTML so user content can never inject markup, even if rendered as HTML. */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip control characters and collapse excessive whitespace/newlines. */
export function cleanText(str, { maxLength = 5000 } = {}) {
  if (str === undefined || str === null) return '';
  let out = String(str)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (out.length > maxLength) out = out.slice(0, maxLength);
  return out;
}

export function slugify(str) {
  const base = String(str || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'item';
}

/* ---------------- misc ---------------- */

export function normalizeEmail(email) {
  const v = String(email || '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) ? v : null;
}

export function normalizePhone(phone) {
  let v = String(phone || '').replace(/[\s\-().]/g, '');
  if (v.startsWith('+212')) v = `0${v.slice(4)}`;
  else if (v.startsWith('00212')) v = `0${v.slice(5)}`;
  else if (v.startsWith('212') && v.length === 12) v = `0${v.slice(3)}`;
  return /^0[5-8]\d{8}$/.test(v) ? v : null;
}

export function maskPhone(phone) {
  if (!phone) return null;
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}

export function maskEmail(email) {
  if (!email) return null;
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}***@${d}`;
}

export function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
}
