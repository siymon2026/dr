import { Router } from 'express';
import { db, now } from '../lib/db.js';
import { z, validate, text, emailSchema } from '../lib/validation.js';
import { asyncHandler, notFound } from '../lib/errors.js';
import { limiters } from '../lib/http.js';
import { sendMail } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';

const router = Router();

router.get(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM pages WHERE slug = ? AND published = 1').get(req.params.slug);
    if (!row) throw notFound('page_not_found');
    res.json({
      page: {
        slug: row.slug,
        title: { ar: row.title_ar, fr: row.title_fr, en: row.title_en },
        body: { ar: row.body_ar, fr: row.body_fr, en: row.body_en },
        updated_at: row.updated_at,
      },
    });
  }),
);

router.get(
  '/faq',
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM faqs WHERE published = 1 ORDER BY sort, id').all();
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        q: { ar: r.q_ar, fr: r.q_fr, en: r.q_en },
        a: { ar: r.a_ar, fr: r.a_fr, en: r.a_en },
      })),
    });
  }),
);

router.post(
  '/contact',
  limiters.contact,
  asyncHandler(async (req, res) => {
    const data = validate(
      z.object({
        name: text(2, 80),
        email: emailSchema,
        subject: text(2, 120).optional(),
        message: text(10, 3000),
      }),
      req.body,
    );
    db.prepare('INSERT INTO contact_messages (name, email, subject, message, created_at) VALUES (?,?,?,?,?)').run(
      data.name,
      data.email,
      data.subject || null,
      data.message,
      now(),
    );
    sendMail({
      to: process.env.CONTACT_INBOX || 'support@bii3chri.ma',
      subject: `[Contact] ${data.subject || 'رسالة جديدة'}`,
      text: `${data.name} <${data.email}>\n\n${data.message}`,
    }).catch((err) => logger.warn({ err }, 'contact mail failed'));
    res.status(201).json({ ok: true, message: 'contact_received' });
  }),
);

router.get(
  '/seo/sitemap-urls',
  asyncHandler(async (_req, res) => {
    const listings = db
      .prepare("SELECT public_id, updated_at FROM listings WHERE status='active' ORDER BY created_at DESC LIMIT 5000")
      .all();
    const categories = db.prepare('SELECT slug FROM categories WHERE active = 1').all();
    const stores = db.prepare("SELECT slug FROM stores WHERE status='active'").all();
    res.json({
      listings: listings.map((l) => ({ url: `/listing/${l.public_id}`, lastmod: new Date(l.updated_at).toISOString() })),
      categories: categories.map((c) => ({ url: `/category/${c.slug}` })),
      stores: stores.map((s) => ({ url: `/stores/${s.slug}` })),
    });
  }),
);

export default router;
