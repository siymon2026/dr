import { Router } from 'express';
import { db } from '../lib/db.js';
import { asyncHandler, notFound } from '../lib/errors.js';

const router = Router();

function mapCategory(row, children = []) {
  return {
    id: row.id,
    slug: row.slug,
    icon: row.icon,
    color: row.color,
    parent_id: row.parent_id,
    name: { ar: row.name_ar, fr: row.name_fr, en: row.name_en },
    description: { ar: row.description_ar, fr: row.description_fr, en: row.description_en },
    listings_count: row.listings_count ?? 0,
    children,
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM listings l WHERE l.status='active' AND (l.category_id = c.id OR l.category_id IN (SELECT id FROM categories WHERE parent_id = c.id))) AS listings_count
         FROM categories c WHERE c.active = 1 ORDER BY c.sort, c.id`,
      )
      .all();

    const parents = rows.filter((r) => !r.parent_id);
    const byParent = new Map();
    for (const r of rows.filter((r) => r.parent_id)) {
      if (!byParent.has(r.parent_id)) byParent.set(r.parent_id, []);
      byParent.get(r.parent_id).push(mapCategory(r));
    }
    res.json({ items: parents.map((p) => mapCategory(p, byParent.get(p.id) || [])) });
  }),
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM categories WHERE slug = ? AND active = 1').get(req.params.slug);
    if (!row) throw notFound('category_not_found');
    const children = db
      .prepare('SELECT * FROM categories WHERE parent_id = ? AND active = 1 ORDER BY sort, id')
      .all(row.id)
      .map((c) => mapCategory(c));
    const parent = row.parent_id ? db.prepare('SELECT * FROM categories WHERE id = ?').get(row.parent_id) : null;
    res.json({
      category: mapCategory(row, children),
      parent: parent ? mapCategory(parent) : null,
      breadcrumb: [
        ...(parent ? [{ slug: parent.slug, name: { ar: parent.name_ar, fr: parent.name_fr, en: parent.name_en } }] : []),
        { slug: row.slug, name: { ar: row.name_ar, fr: row.name_fr, en: row.name_en } },
      ],
    });
  }),
);

export default router;
