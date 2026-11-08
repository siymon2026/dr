import { db, now, toJson } from './db.js';
import { publish } from './realtime.js';
import { logger } from './logger.js';
import { sendMail } from './mailer.js';

const insert = db.prepare(`
  INSERT INTO notifications (user_id, type, title_key, body, link, data, created_at)
  VALUES (@user_id, @type, @title_key, @body, @link, @data, @created_at)
`);

/**
 * Create an in-app notification and push it over SSE if the user is online.
 * Email delivery is queued only for high-value event types.
 */
export function notify(userId, { type, titleKey, body = null, link = null, data = null, email = null }) {
  try {
    const info = insert.run({
      user_id: userId,
      type,
      title_key: titleKey,
      body,
      link,
      data: toJson(data),
      created_at: now(),
    });
    const notification = {
      id: info.lastInsertRowid,
      type,
      title_key: titleKey,
      body,
      link,
      data,
      read_at: null,
      created_at: now(),
    };
    publish(userId, 'notification', notification);
    if (email) {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
      if (user?.email) {
        sendMail({ to: user.email, subject: email.subject, text: email.text }).catch((err) =>
          logger.warn({ err }, 'notification email failed'),
        );
      }
    }
    return notification;
  } catch (err) {
    logger.error({ err, userId, type }, 'failed to create notification');
    return null;
  }
}

export const NOTIFICATION_TYPES = {
  MESSAGE: 'message',
  LISTING_APPROVED: 'listing_approved',
  LISTING_REJECTED: 'listing_rejected',
  LISTING_EXPIRING: 'listing_expiring',
  LISTING_FAVORITED: 'listing_favorited',
  LISTING_SOLD: 'listing_sold',
  SUBSCRIPTION_EXPIRING: 'subscription_expiring',
  REPORT_UPDATE: 'report_update',
  ACCOUNT_UPDATE: 'account_update',
  STORE_UPDATE: 'store_update',
  REVIEW_RECEIVED: 'review_received',
  ORDER_PAID: 'order_paid',
  SYSTEM: 'system',
};
