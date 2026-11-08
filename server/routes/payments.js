import { Router } from 'express';
import { db, now } from '../lib/db.js';
import { config, isPaymentProviderLive } from '../config.js';
import { z, validate } from '../lib/validation.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { limiters } from '../lib/http.js';
import { randomToken } from '../lib/security.js';
import { audit } from '../lib/audit.js';
import { applyPaidOrder } from '../lib/billing.js';

const router = Router();

function priceCoupon(coupon, amount) {
  if (!coupon) return { discount: 0, note: null };
  if (coupon.percent > 0) return { discount: Math.round((amount * coupon.percent) / 100), note: `${coupon.percent}%` };
  if (coupon.amount_cents > 0) return { discount: Math.min(amount, coupon.amount_cents), note: 'fixed' };
  return { discount: 0, note: null };
}

function findCoupon(code) {
  if (!code) return null;
  const ts = now();
  const coupon = db
    .prepare("SELECT * FROM coupons WHERE code = ? AND active = 1")
    .get(String(code).trim());
  if (!coupon) return null;
  if (coupon.starts_at && coupon.starts_at > ts) return null;
  if (coupon.expires_at && coupon.expires_at < ts) return null;
  if (coupon.max_uses > 0 && coupon.uses >= coupon.max_uses) return null;
  return coupon;
}

const checkoutSchema = z.object({
  kind: z.enum(['plan', 'boost']),
  plan_code: z.string().max(40).optional(),
  boost_code: z.string().max(40).optional(),
  listing_id: z.coerce.number().int().positive().optional(),
  coupon: z.string().max(40).optional(),
});

router.post(
  '/checkout',
  requireAuth,
  limiters.write,
  asyncHandler(async (req, res) => {
    const data = validate(checkoutSchema, req.body);

    let amount = 0;
    let planId = null;
    let boostId = null;

    if (data.kind === 'plan') {
      const plan = db.prepare('SELECT * FROM plans WHERE code = ? AND active = 1').get(String(data.plan_code || ''));
      if (!plan) throw notFound('plan_not_found');
      amount = plan.price_cents;
      planId = plan.id;
    } else {
      const boost = db.prepare('SELECT * FROM boost_products WHERE code = ? AND active = 1').get(String(data.boost_code || ''));
      if (!boost) throw notFound('boost_not_found');
      if (!data.listing_id) throw badRequest('listing_required');
      const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(data.listing_id);
      if (!listing) throw notFound('listing_not_found');
      if (listing.user_id !== req.user.id && !['admin', 'superadmin'].includes(req.user.role)) throw forbidden();
      amount = boost.price_cents;
      boostId = boost.id;
    }

    const coupon = findCoupon(data.coupon);
    const { discount } = priceCoupon(coupon, amount);
    const total = Math.max(0, amount - discount);

    const reference = `BC-${randomToken(6).toUpperCase()}`;
    const ts = now();
    const info = db
      .prepare(
        `INSERT INTO orders (reference, user_id, kind, plan_id, boost_id, listing_id, amount_cents, discount_cents,
                             currency, coupon_id, status, provider, created_at)
         VALUES (?,?,?,?,?,?,?,?,'MAD',?,?,?,?)`,
      )
      .run(
        reference,
        req.user.id,
        data.kind,
        planId,
        boostId,
        data.listing_id ?? null,
        amount,
        discount,
        coupon?.id ?? null,
        'pending',
        isPaymentProviderLive ? config.payments.provider : 'manual',
        ts,
      );

    const orderId = Number(info.lastInsertRowid);
    audit(req, 'order.created', { entityType: 'order', entityId: orderId, meta: { reference, total } });

    // A real payment is NEVER taken here. We only create a pending order.
    res.status(201).json({
      order: {
        id: orderId,
        reference,
        amount: total / 100,
        discount: discount / 100,
        currency: 'MAD',
        status: 'pending',
      },
      payment_ready: isPaymentProviderLive,
      checkout_url: null,
      notice: isPaymentProviderLive ? 'redirect_to_provider' : 'payment_provider_not_configured',
    });
  }),
);

router.post(
  '/validate-coupon',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code, amount_cents } = validate(
      z.object({ code: z.string().min(2).max(40), amount_cents: z.coerce.number().int().min(0) }),
      req.body,
    );
    const coupon = findCoupon(code);
    if (!coupon) throw badRequest('invalid_coupon');
    if (coupon.min_amount_cents && amount_cents < coupon.min_amount_cents) throw badRequest('coupon_min_amount');
    const { discount } = priceCoupon(coupon, amount_cents);
    res.json({ valid: true, discount: discount / 100, code: coupon.code });
  }),
);

router.get(
  '/orders',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT o.*, p.name_ar AS plan_name, b.name_ar AS boost_name
         FROM orders o
         LEFT JOIN plans p ON p.id = o.plan_id
         LEFT JOIN boost_products b ON b.id = o.boost_id
         WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 100`,
      )
      .all(req.user.id);
    res.json({
      items: rows.map((o) => ({
        id: o.id,
        reference: o.reference,
        kind: o.kind,
        title: o.plan_name || o.boost_name || o.kind,
        amount: o.amount_cents / 100,
        discount: o.discount_cents / 100,
        currency: o.currency,
        status: o.status,
        provider: o.provider,
        created_at: o.created_at,
        paid_at: o.paid_at,
      })),
      payment_ready: isPaymentProviderLive,
    });
  }),
);

/**
 * Offline settlement (bank transfer / cash to the merchant) is recorded by
 * finance staff only, and always with an audit entry.
 */
router.post(
  '/orders/:id/mark-paid-offline',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Authorization is evaluated before existence so users cannot probe order ids.
    if (!['admin', 'superadmin', 'finance'].includes(req.user.role)) throw forbidden();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
    if (!order) throw notFound('order_not_found');
    if (order.status === 'paid') throw conflict('already_paid');
    applyPaidOrder(order.id, { provider: 'manual', providerRef: `offline-${req.user.id}` });
    audit(req, 'order.marked_paid_offline', { entityType: 'order', entityId: order.id });
    res.json({ ok: true });
  }),
);

export default router;
