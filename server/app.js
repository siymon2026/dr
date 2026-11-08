import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import { config } from './config.js';
import { db } from './lib/db.js';
import { logger } from './lib/logger.js';
import { attachUser, ensureCsrfCookie, serializeUser } from './lib/auth.js';
import { csrfProtect, limiters } from './lib/http.js';
import { AppError } from './lib/errors.js';

import authRoutes from './routes/auth.js';
import listingsRoutes from './routes/listings.js';
import uploadsRoutes from './routes/uploads.js';
import categoriesRoutes from './routes/categories.js';
import geoRoutes from './routes/geo.js';
import favoritesRoutes from './routes/favorites.js';
import conversationsRoutes from './routes/conversations.js';
import storesRoutes from './routes/stores.js';
import reviewsRoutes from './routes/reviews.js';
import reportsRoutes from './routes/reports.js';
import plansRoutes from './routes/plans.js';
import paymentsRoutes from './routes/payments.js';
import notificationsRoutes from './routes/notifications.js';
import contentRoutes from './routes/content.js';
import adminRoutes from './routes/admin.js';
import { registerWebhookRoutes } from './routes/webhooks.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: config.isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'", ...(config.apiUrl && config.apiUrl !== config.appUrl ? [config.apiUrl] : [])],
              frameAncestors: ["'self'", 'https://*.e2b.app'],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              upgradeInsecureRequests: config.security.cookieSecure ? [] : null,
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(compression());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : 'debug'),
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  // Serve uploaded media with hardened headers and long cache.
  app.use(
    config.uploads.publicPrefix,
    express.static(config.uploads.dir, {
      maxAge: '30d',
      immutable: true,
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
      },
    }),
  );

  app.use(attachUser);

  // ---------- public API ----------
  app.get('/api/health', (_req, res) =>
    res.json({ ok: true, env: config.env, time: new Date().toISOString() }),
  );

  app.get('/api/session', (req, res) => {
    const csrfToken = ensureCsrfCookie(req, res);
    res.json({
      user: serializeUser(req.user, { self: true }),
      csrfToken,
      paymentsLive: false,
      flags: {
        mail: config.mail.enabled,
        sms: config.sms.enabled,
        push: config.push.enabled,
        moderationAutoApprove: config.moderation.autoApprove,
      },
    });
  });

  // CSRF applies to every state-changing API call.
  app.use('/api', csrfProtect);

  // Per-route limiters live inside the auth router (login/register/OTP only),
  // so ordinary profile updates are not throttled by login policy.
  app.use('/api/auth', authRoutes);
  app.use('/api/listings', listingsRoutes);
  app.use('/api/uploads', limiters.upload, uploadsRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/geo', geoRoutes);
  app.use('/api/favorites', favoritesRoutes);
  app.use('/api/conversations', conversationsRoutes);
  app.use('/api/stores', storesRoutes);
  app.use('/api/reviews', reviewsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/plans', plansRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/admin', adminRoutes);
  registerWebhookRoutes(app);

  // ---------- SEO: sitemap.xml built from the database ----------
  app.get('/sitemap.xml', (req, res) => {
    const base = (config.appUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const urls = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/listings', priority: '0.9', changefreq: 'hourly' },
      { loc: '/categories', priority: '0.7', changefreq: 'weekly' },
      { loc: '/stores', priority: '0.7', changefreq: 'daily' },
      { loc: '/pricing', priority: '0.6', changefreq: 'monthly' },
      { loc: '/help', priority: '0.4', changefreq: 'monthly' },
      { loc: '/about', priority: '0.3', changefreq: 'yearly' },
      { loc: '/contact', priority: '0.3', changefreq: 'yearly' },
      { loc: '/page/privacy', priority: '0.2', changefreq: 'yearly' },
      { loc: '/page/terms', priority: '0.2', changefreq: 'yearly' },
    ];
    try {
      db.prepare("SELECT public_id, updated_at FROM listings WHERE status='active' ORDER BY created_at DESC LIMIT 20000")
        .all()
        .forEach((l) => urls.push({
          loc: `/listing/${l.public_id}`,
          lastmod: new Date(l.updated_at).toISOString().slice(0, 10),
          priority: '0.8',
          changefreq: 'weekly',
        }));
      db.prepare('SELECT slug FROM categories WHERE active = 1')
        .all()
        .forEach((c) => urls.push({ loc: `/category/${c.slug}`, priority: '0.6', changefreq: 'daily' }));
      db.prepare("SELECT slug, updated_at FROM stores WHERE status='active' LIMIT 5000")
        .all()
        .forEach((s) => urls.push({
          loc: `/stores/${s.slug}`,
          lastmod: new Date(s.updated_at).toISOString().slice(0, 10),
          priority: '0.6',
          changefreq: 'weekly',
        }));
    } catch {
      /* database unavailable — still serve the static entries */
    }
    const body = urls
      .map((u) => `  <url><loc>${base}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
      .join('\n');
    res.type('application/xml').set('Cache-Control', 'public, max-age=1800').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`,
    );
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'route_not_found' } }));

  // ---------- SPA (production build) ----------
  const distDir = path.join(config.root, 'dist');
  if (config.serveStatic && fs.existsSync(distDir)) {
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '7d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // ---------- error handling ----------
  app.use((err, req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'payload_too_large', message: 'payload_too_large' } });
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: { code: 'file_too_large', message: 'file_too_large' } });
    }
    // Multer limits (file count, unexpected field) are client errors, never 500s.
    if (err?.name === 'MulterError') {
      const map = {
        LIMIT_FILE_COUNT: ['too_many_files', 400],
        LIMIT_UNEXPECTED_FILE: ['unexpected_file_field', 400],
        LIMIT_PART_COUNT: ['upload_too_large', 413],
        LIMIT_FIELD_KEY: ['invalid_field', 400],
        LIMIT_FIELD_VALUE: ['invalid_field', 400],
      };
      const [code, status] = map[err.code] || ['upload_rejected', 400];
      return res.status(status).json({ error: { code, message: code, details: { limit: err.field || null } } });
    }
    logger.error({ err, url: req.originalUrl, method: req.method }, 'unhandled error');
    res.status(500).json({ error: { code: 'server_error', message: 'server_error' } });
  });

  return app;
}

export default createApp;
