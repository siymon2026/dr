import { Router } from 'express';
import { db } from '../lib/db.js';
import { asyncHandler } from '../lib/errors.js';

const router = Router();

router.get(
  '/cities',
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM listings l WHERE l.city_id = c.id AND l.status='active') AS listings_count
         FROM cities c WHERE c.active = 1 ORDER BY c.sort, c.name_ar`,
      )
      .all();
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: { ar: r.name_ar, fr: r.name_fr, en: r.name_en },
        region: r.region,
        lat: r.lat,
        lng: r.lng,
        listings_count: r.listings_count,
      })),
    });
  }),
);

router.get(
  '/cities/:id/areas',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare('SELECT * FROM areas WHERE city_id = ? AND active = 1 ORDER BY name_ar')
      .all(Number(req.params.id));
    res.json({
      items: rows.map((r) => ({ id: r.id, name: { ar: r.name_ar, fr: r.name_fr, en: r.name_en } })),
    });
  }),
);

export default router;
