import { Router } from 'express';
import { db, now, fromJson } from '../lib/db.js';
import { asyncHandler, notFound } from '../lib/errors.js';

const router = Router();

function mapPlan(row) {
  return {
    id: row.id,
    code: row.code,
    name: { ar: row.name_ar, fr: row.name_fr, en: row.name_en },
    description: { ar: row.description_ar, fr: row.description_fr, en: row.description_en },
    price: row.price_cents / 100,
    price_cents: row.price_cents,
    currency: row.currency,
    duration_days: row.duration_days,
    listing_quota: row.listing_quota,
    featured_quota: row.featured_quota,
    is_store_plan: !!row.is_store_plan,
    features: fromJson(row.features, []),
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const plans = db.prepare('SELECT * FROM plans WHERE active = 1 ORDER BY sort, price_cents').all();
    const boosts = db
      .prepare('SELECT * FROM boost_products WHERE active = 1 ORDER BY sort, price_cents')
      .all()
      .map((b) => ({
        id: b.id,
        code: b.code,
        type: b.type,
        name: { ar: b.name_ar, fr: b.name_fr, en: b.name_en },
        price: b.price_cents / 100,
        price_cents: b.price_cents,
        duration_days: b.duration_days,
      }));
    res.json({
      plans: plans.map(mapPlan),
      boosts,
      payment_ready: false,
      notice: 'payments_not_configured',
    });
  }),
);

router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    if (!req.user) return res.json({ subscription: null });
    const row = db
      .prepare(
        `SELECT s.*, p.name_ar, p.name_fr, p.name_en, p.listing_quota, p.featured_quota
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
         WHERE s.user_id = ? AND s.status = 'active' ORDER BY s.ends_at DESC LIMIT 1`,
      )
      .get(req.user.id);
    res.json({
      subscription: row
        ? {
            id: row.id,
            plan_id: row.plan_id,
            name: { ar: row.name_ar, fr: row.name_fr, en: row.name_en },
            starts_at: row.starts_at,
            ends_at: row.ends_at,
            listing_quota: row.listing_quota,
            featured_quota: row.featured_quota,
            days_left: Math.max(0, Math.ceil((row.ends_at - now()) / 864e5)),
          }
        : null,
    });
  }),
);

router.get(
  '/:code',
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM plans WHERE code = ? AND active = 1').get(req.params.code);
    if (!row) throw notFound('plan_not_found');
    res.json({ plan: mapPlan(row) });
  }),
);

export default router;
