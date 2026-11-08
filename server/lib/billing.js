import { db, now } from './db.js';
import { logger } from './logger.js';
import { notify, NOTIFICATION_TYPES } from './notify.js';

/**
 * Applies the effect of a PAID order exactly once:
 *  - plan      → create/extend a subscription
 *  - boost     → feature / pin / bump a listing for the product duration
 * Called only from verified webhooks or an audited staff action.
 */
export function applyPaidOrder(orderId, { provider = 'manual', providerRef = null } = {}) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error(`order ${orderId} not found`);
  if (order.status === 'paid') return { alreadyApplied: true };

  const ts = now();

  db.transaction(() => {
    db.prepare(
      "UPDATE orders SET status='paid', paid_at=?, provider=?, provider_ref=? WHERE id=? AND status != 'paid'",
    ).run(ts, provider, providerRef, order.id);

    if (order.kind === 'plan' && order.plan_id) {
      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(order.plan_id);
      if (plan) {
        const active = db
          .prepare(
            "SELECT * FROM subscriptions WHERE user_id = ? AND plan_id = ? AND status = 'active' AND ends_at > ? LIMIT 1",
          )
          .get(order.user_id, plan.id, ts);
        if (active) {
          db.prepare('UPDATE subscriptions SET ends_at = ends_at + ? WHERE id = ?').run(
            plan.duration_days * 864e5,
            active.id,
          );
        } else {
          db.prepare(
            `INSERT INTO subscriptions (user_id, plan_id, order_id, starts_at, ends_at, listing_used, status, created_at)
             VALUES (?,?,?,?,?,0,'active',?)`,
          ).run(order.user_id, plan.id, order.id, ts, ts + plan.duration_days * 864e5, ts);
        }
        if (plan.is_store_plan) {
          db.prepare('UPDATE users SET is_store = 1 WHERE id = ?').run(order.user_id);
        }
      }
    }

    if (order.kind === 'boost' && order.boost_id && order.listing_id) {
      const boost = db.prepare('SELECT * FROM boost_products WHERE id = ?').get(order.boost_id);
      const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(order.listing_id);
      if (boost && listing) {
        const until = ts + boost.duration_days * 864e5;
        if (boost.type === 'feature') {
          db.prepare('UPDATE listings SET is_featured = 1, featured_until = ? WHERE id = ?').run(until, listing.id);
        } else if (boost.type === 'pin') {
          db.prepare('UPDATE listings SET is_pinned = 1, pinned_until = ? WHERE id = ?').run(until, listing.id);
        } else if (boost.type === 'bump') {
          db.prepare('UPDATE listings SET bumped_at = ?, created_at = created_at WHERE id = ?').run(ts, listing.id);
        }
      }
    }

    if (order.coupon_id) {
      db.prepare('UPDATE coupons SET uses = uses + 1 WHERE id = ?').run(order.coupon_id);
    }
  })();

  notify(order.user_id, {
    type: NOTIFICATION_TYPES.ORDER_PAID,
    titleKey: 'notif.order_paid',
    body: order.reference,
    link: '/pricing',
    data: { order_id: order.id },
  });

  logger.info({ orderId: order.id, provider }, 'order applied');
  return { applied: true, orderId: order.id };
}
