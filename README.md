# بيع وشري أونلاين — Bii3 & Chri Online

منصة مغربية حقيقية لبيع وشراء كل شيء (سيارات، عقارات، هواتف، أثاث…) — **production-ready**،
بواجهة عربية RTL كاملة مع الفرنسية والإنجليزية، ولوحة إدارة كاملة، ونظام اشتراكات وتمييز إعلانات.

A real Moroccan marketplace: SPA front-end (React 18 + Vite), REST API (Express 4) on SQLite with
WAL, image pipeline (Sharp → WebP), real-time in-app notifications (SSE), moderation, stores,
reviews, plans/boosts/coupons and a full role-based admin dashboard.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Front-end | React 18, React Router 6, Vite 5 | no UI kit, hand-built design system (`src/styles.css`) |
| State | React Context (`src/state/AppContext.jsx`) | lang, theme, session, cities, categories, unread, toasts |
| API | Express 4 (`server/app.js`) | mounted under `/api`, JSON only, zod validation everywhere |
| DB | SQLite (`better-sqlite3`), WAL | 38 tables, FTS5 search, foreign keys ON, migrations in `server/db/schema.sql` |
| Auth | HMAC-signed session cookie `bc_session` + `scrypt` password hashes | rotating sessions, per-device logout, `logout-all` |
| CSRF | double-submit token (`bc_csrf` cookie + `x-csrf-token` header) | re-read on every response, survives login |
| Uploads | multer → Sharp → WebP (3 sizes) | SVG/non-images rejected, magic-byte sniffing, size limits |
| Realtime | Server-Sent Events `GET /api/notifications/stream` | messages, notifications, order/report events |
| Logging | pino + pino-http + `audit_log` | every sensitive action is audited with actor/IP |

## 2. Quick start

```bash
cp ENV.example .env          # fill JWT_SECRET etc.
npm install
npm run db:migrate           # creates data/bii3chri.db from schema.sql
npm run db:seed              # 31 cities, 85 categories (18 roots), demo users & listings
npm run dev                  # API :4000 + web :5173 (Vite proxies /api and /uploads)
# or: npm run dev:api / npm run dev:web separately
```

Production:

```bash
npm run build               # dist/
SERVE_STATIC=1 NODE_ENV=production node server/index.js   # or `npm start`
```

`npm run db:reset` wipes and reseeds. `npm run admin:create` creates/promotes a superadmin.
`npm run test` / `node tests/smoke.mjs` runs the 84-assertion end-to-end API suite.

### Seeded accounts (change the passwords before going live)

| Role | Email | Password |
|---|---|---|
| superadmin | `admin@bii3chri.ma` | `Admin@12345` |
| moderator | `moderator@bii3chri.ma` | `Moderator@12345` |
| finance | `finance@bii3chri.ma` | `Finance@12345` |
| support | `support@bii3chri.ma` | `Support@12345` |
| seller (demo) | `youssef@demo.ma` | `Demo@12345` |

`SEED_DEMO=false` seeds only reference data (no demo accounts/listings).

## 3. Pages

**23 required pages are implemented and routed in `src/App.jsx`:**

`/` home · `/listings` all ads (+ `/listings/featured`) · `/listing/:publicId` ad detail ·
`/categories` · `/category/:slug` category · `/login` · `/register` · `/forgot-password` ·
`/reset-password` · `/users/:id` public profile · `/my-listings` · `/post` add ad ·
`/listings/:id/edit` edit ad · `/favorites` · `/messages` + `/messages/:id` conversations ·
`/stores` · `/stores/:slug` store page · `/store/new` + `/store/manage` · `/pricing` plans ·
`/page/:slug` (about/privacy/terms) · `/help` help center · `/contact` · `/notifications` ·
`/account` · `/admin/*` dashboard (overview, listings, users, stores, reports, categories,
cities, finance, plans, coupons, content, notifications, staff, settings, audit) · `*` 404.

Everything is DB-backed: no mock arrays, no dead buttons, every form calls the API.

## 4. Feature highlights

- **Search** — FTS5 keyword search (Arabic + French + English), filters (category incl. children,
  city/area, price range, condition, date, seller, featured, with-photos), sorts (relevance, newest,
  price ↑/↓, most viewed) and pagination. Indexed; `total`/`pages` returned by the API.
- **Ads** — 3-step wizard (info → price/location/contact → photos), up to 15 WebP images with a
  primary cover, edit, pause/resume, mark sold, republish, delete, share, view counter,
  "interested" counter, quota per plan, 60-day TTL, moderation queue before going live.
- **Chat** — conversation per (listing, buyer), text + image messages, read receipts, unread
  counters, last-seen respecting privacy, block/unblock, report, SSE live updates, private by RLS
  check (outsiders get 403).
- **Stores** — logo/cover, description, city, contact, products, reviews, followers, sales/views
  stats, follow button; store accounts are marked and verified only by an admin.
- **Reviews & trust** — 1–5 stars + comment per buyer/seller pair (duplicates blocked), average
  recomputed server-side, fraud reports, admin-only verification badge.
- **Monetization** — free ad, featured/pin/bump boosts, monthly trader plans (higher quota), coupons
  validated server-side, full order log. **No real payment is taken**: with
  `PAYMENT_PROVIDER=none` checkout always returns `payment_provider_not_configured` and a `pending`
  order with `checkout_url: null`. Orders become `paid` only through a **verified** webhook
  (`/api/webhooks/...`, HMAC-checked) or an audited finance action.
- **Admin** — KPIs + 14-day series, moderation queue with bulk actions and required reject reasons,
  user status/roles/verification, store approval, reports workflow, categories & subcategories,
  cities & areas, finance with CSV export, plans/boosts/coupons, CMS pages & FAQ, broadcast
  notifications, staff permissions, platform settings, audit log. Roles are ranked
  (superadmin > admin > finance/moderator/support > user); nobody can grant a role at or above their
  own, and staff cannot edit their own permissions.
- **Notifications** — new message, interest, expiry, approval/rejection, subscription expiring,
  complaint reply, account & store updates. Stored in DB + pushed over SSE; mail/SMS/push adapters
  already wired (`server/lib/mailer.js`, `notify.js`) and switched on by env keys.
- **Security** — scrypt hashing, HttpOnly/SameSite cookies, CSRF on all mutations, helmet CSP,
  zod validation on every endpoint, HTML sanitisation of user text, parameterised SQL only,
  per-route rate limits (login/register/write/upload/message/report/contact), upload type+size+
  dimension checks, server-side permission checks on every admin endpoint, audit trail,
  daily DB backups (`DB_BACKUP_ENABLED`), data export & account deletion from `/account`.
- **Performance & UX** — code-split routes (lazy), WebP + responsive image variants, lazy image
  loading, skeletons, pagination/infinite lists, per-page `<title>`/meta, clean ad URLs
  (`/listing/demo001sn5LH`), OpenGraph/social share, human-readable error messages, loading/success/
  failure states everywhere, dark mode, mobile bottom nav, RTL-aware layout.

## 5. API map (abridged)

```
POST /api/auth/{register,login,logout,logout-all,forgot-password,reset-password,change-password}
GET/PATCH/DELETE /api/auth/me      GET /api/auth/me/activity   GET /api/auth/me/export
GET  /api/listings  /api/listings/home  /api/listings/nearby  /api/listings/mine  /api/listings/quota/me
GET/POST/PATCH/DELETE /api/listings[/:id]   POST /api/listings/:id/status|promote|contact
GET  /api/categories  /api/geo/cities  /api/geo/cities/:id/areas
GET/POST /api/favorites            GET /api/favorites
GET  /api/conversations  /api/conversations/:id  POST .../messages .../image .../read  block/unblock
GET/POST /api/stores  /api/stores/mine  /api/stores/:slug  PATCH /api/stores/:id  POST .../follow
GET  /api/plans  /api/plans/mine   POST /api/payments/checkout  /api/payments/validate-coupon
GET  /api/notifications  POST .../read .../read-all   GET /api/notifications/stream (SSE)
GET  /api/content/pages/:slug  /api/content/faq   POST /api/content/contact
GET  /api/admin/stats|users|listings|stores|reports|finance/summary|orders|plans|coupons|
     categories|cities|pages|faqs|settings|staff|audit  (+ mutations, all permission-gated)
POST /api/webhooks/:provider        (HMAC-verified payment callbacks)
```

## 6. Deployment notes

1. `NODE_ENV=production`, strong `JWT_SECRET`, `COOKIE_SECURE=true` behind HTTPS,
   `TRUST_PROXY=true` when behind nginx/Cloudflare.
2. Build once (`npm run build`), run `SERVE_STATIC=1 npm start` behind a reverse proxy that forwards
   `/api` and `/uploads` to the same process.
3. Back up `data/` and `uploads/` (or point `DB_BACKUP_DIR` at your volume); SQLite WAL is enabled.
4. Set `PAYMENT_PROVIDER` + keys + webhook secret **and verify the webhook** before enabling paid
   plans for real; until then the UI states that online payment is not yet available.
5. SMTP / SMS / Push keys are optional — the app degrades gracefully (in-app notifications only).

## 7. Repository layout

```
server/            API: app.js, index.js, db/{schema.sql,seed-data.js}, lib/*, routes/*, scripts/*
src/               React app: main.jsx, App.jsx, styles.css, i18n.js, lib/, state/, components/, pages/
tests/smoke.mjs    84-assertion end-to-end API suite
data/ uploads/     runtime state (git-ignored)
ENV.example        every supported environment variable, no secrets
```
