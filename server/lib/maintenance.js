import { db, now } from './db.js';
import { logger } from './logger.js';
import { notify, NOTIFICATION_TYPES } from './notify.js';

/**
 * Periodic housekeeping:
 *  - expire listings past expires_at
 *  - pause featured/pinned flags whose window ended
 *  - drop expired sessions / OTPs / reset tokens
 *  - expire subscriptions and warn users 3 days ahead
 *  - remind owners whose listings expire within 3 days
 */
export function runMaintenance() {
  const ts = now();
  const stats = {};

  stats.expiredListings = db
    .prepare("UPDATE listings SET status='expired', updated_at=? WHERE status='active' AND expires_at < ?")
    .run(ts, ts).changes;

  db.prepare('UPDATE listings SET is_featured=0 WHERE is_featured=1 AND featured_until IS NOT NULL AND featured_until < ?').run(ts);
  db.prepare('UPDATE listings SET is_pinned=0 WHERE is_pinned=1 AND pinned_until IS NOT NULL AND pinned_until < ?').run(ts);

  stats.sessions = db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(ts).changes;
  db.prepare('DELETE FROM otp_codes WHERE expires_at < ? OR consumed_at IS NOT NULL').run(ts - 864e5);
  db.prepare('DELETE FROM password_resets WHERE expires_at < ? OR used_at IS NOT NULL').run(ts);

  stats.expiredSubs = db
    .prepare("UPDATE subscriptions SET status='expired' WHERE status='active' AND ends_at < ?")
    .run(ts).changes;

  // Warn about subscriptions ending in the next 3 days (once per day per user).
  const subsEnding = db
    .prepare(
      `SELECT s.id, s.user_id, s.ends_at, p.name_ar FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.status='active' AND s.ends_at BETWEEN ? AND ?`,
    )
    .all(ts, ts + 3 * 864e5);
  for (const s of subsEnding) {
    const recent = db
      .prepare(
        "SELECT 1 FROM notifications WHERE user_id=? AND type=? AND created_at > ? LIMIT 1",
      )
      .get(s.user_id, NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING, ts - 864e5);
    if (!recent) {
      notify(s.user_id, {
        type: NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING,
        titleKey: 'notif.subscription_expiring',
        body: s.name_ar,
        link: '/pricing',
      });
    }
  }

  // Remind owners about listings about to expire.
  const listingsEnding = db
    .prepare(
      `SELECT id, user_id, title, expires_at FROM listings
       WHERE status='active' AND expires_at BETWEEN ? AND ?`,
    )
    .all(ts, ts + 3 * 864e5);
  for (const l of listingsEnding) {
    const recent = db
      .prepare(
        "SELECT 1 FROM notifications WHERE user_id=? AND type=? AND json_extract(data,'$.listing_id')=? AND created_at > ? LIMIT 1",
      )
      .get(l.user_id, NOTIFICATION_TYPES.LISTING_EXPIRING, l.id, ts - 864e5);
    if (!recent) {
      notify(l.user_id, {
        type: NOTIFICATION_TYPES.LISTING_EXPIRING,
        titleKey: 'notif.listing_expiring',
        body: l.title,
        link: `/listings/${l.id}/edit`,
        data: { listing_id: l.id },
      });
    }
  }

  stats.pendingListings = db
    .prepare("SELECT COUNT(*) c FROM listings WHERE status='pending'")
    .get().c;

  logger.info(stats, 'maintenance cycle complete');
  return stats;
}
