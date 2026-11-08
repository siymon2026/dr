/**
 * Runtime platform settings.
 *
 * Values live in the `settings` table and are editable from the admin dashboard.
 * They are cached for a short TTL so hot paths (listing creation, registration)
 * do not hit SQLite on every request, and every write clears the cache.
 *
 * Precedence: DB setting (if present) > environment/config default.
 */
import { db, now } from './db.js';
import { config } from '../config.js';

const TTL_MS = 15_000;

const DEFAULTS = {
  site_name_ar: 'بيع وشري أونلاين',
  site_name_fr: 'Bii3 & Chri Online',
  site_name_en: 'Bii3 & Chri Online',
  support_email: 'support@bii3chri.ma',
  support_phone: '',
  listing_ttl_days: 60,
  free_listing_quota: 5,
  moderation_auto_approve: false,
  maintenance_mode: false,
  maintenance_message_ar: 'المنصة في صيانة قصيرة، سنعود بعد قليل.',
  maintenance_message_fr: 'Maintenance en cours, retour très bientôt.',
  maintenance_message_en: 'Short maintenance, back in a moment.',
  contact_inbox: '',
  signup_enabled: true,
  listing_max_images: 15,
};

let cache = { at: 0, values: null };

function coerce(key, raw) {
  const fallback = DEFAULTS[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof fallback === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    return String(raw).toLowerCase() === 'true' || String(raw) === '1';
  }
  if (typeof fallback === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  return String(raw);
}

/** All settings merged with defaults (cached). */
export function getSettings() {
  const ts = Date.now();
  if (cache.values && ts - cache.at < TTL_MS) return cache.values;
  const values = { ...DEFAULTS };
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    for (const row of rows) {
      if (!(row.key in DEFAULTS)) continue;
      let parsed = row.value;
      try {
        parsed = JSON.parse(row.value);
      } catch {
        /* plain string */
      }
      values[row.key] = coerce(row.key, parsed);
    }
  } catch {
    /* table missing during bootstrap — fall back to defaults */
  }
  cache = { at: ts, values };
  return values;
}

/** One setting by key. */
export function setting(key) {
  return getSettings()[key];
}

/** Force the next read to hit the database. */
export function invalidateSettings() {
  cache = { at: 0, values: null };
}

/** Write a setting and invalidate the cache. Used by the admin API and seeder. */
export function saveSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), now());
  invalidateSettings();
}

/** Public (non-sensitive) settings the web app may read without logging in. */
export function publicSettings() {
  const s = getSettings();
  return {
    site_name: { ar: s.site_name_ar, fr: s.site_name_fr, en: s.site_name_en },
    support: { email: s.support_email, phone: s.support_phone },
    maintenance: {
      mode: s.maintenance_mode,
      message: {
        ar: s.maintenance_message_ar,
        fr: s.maintenance_message_fr,
        en: s.maintenance_message_en,
      },
    },
    signup_enabled: s.signup_enabled,
    listing_ttl_days: s.listing_ttl_days,
    free_listing_quota: s.free_listing_quota,
    auto_approve: s.moderation_auto_approve,
    payments_live: false,
    channels: { mail: config.mail.enabled, sms: config.sms.enabled, push: config.push.enabled },
  };
}

export { DEFAULTS as SETTING_DEFAULTS };
