-- ============================================================
-- Bii3 & Chri Online — SQLite schema
-- Timestamps are INTEGER milliseconds since epoch (UTC).
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------- Users & auth ----------
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT UNIQUE COLLATE NOCASE,
  phone           TEXT UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  avatar          TEXT,
  city_id         INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  bio             TEXT,
  role            TEXT NOT NULL DEFAULT 'user',          -- user|moderator|finance|support|admin|superadmin
  status          TEXT NOT NULL DEFAULT 'active',        -- active|suspended|banned
  status_reason   TEXT,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  phone_verified  INTEGER NOT NULL DEFAULT 0,
  verified_seller INTEGER NOT NULL DEFAULT 0,            -- admin-granted badge
  is_store        INTEGER NOT NULL DEFAULT 0,
  locale          TEXT NOT NULL DEFAULT 'ar',
  show_phone      INTEGER NOT NULL DEFAULT 1,
  show_last_seen  INTEGER NOT NULL DEFAULT 1,
  allow_messages  INTEGER NOT NULL DEFAULT 1,
  last_seen_at    INTEGER,
  token_version   INTEGER NOT NULL DEFAULT 0,
  rating_avg      REAL NOT NULL DEFAULT 0,
  rating_count    INTEGER NOT NULL DEFAULT 0,
  listings_count  INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city_id);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  ip           TEXT,
  user_agent   TEXT,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL DEFAULT 'phone',   -- phone|email|login
  target     TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, permission)
);

-- ---------- Geography ----------
CREATE TABLE IF NOT EXISTS cities (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  slug     TEXT NOT NULL UNIQUE,
  name_ar  TEXT NOT NULL,
  name_fr  TEXT NOT NULL,
  name_en  TEXT NOT NULL,
  region   TEXT,
  lat      REAL,
  lng      REAL,
  active   INTEGER NOT NULL DEFAULT 1,
  sort     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS areas (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  active  INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_areas_city ON areas(city_id);

-- ---------- Taxonomy ----------
CREATE TABLE IF NOT EXISTS categories (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id     INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL UNIQUE,
  name_ar       TEXT NOT NULL,
  name_fr       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  icon          TEXT,
  color         TEXT,
  description_ar TEXT,
  description_fr TEXT,
  sort          INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- ---------- Stores ----------
CREATE TABLE IF NOT EXISTS stores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  logo            TEXT,
  cover           TEXT,
  description     TEXT,
  city_id         INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  phone           TEXT,
  whatsapp        TEXT,
  website         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|active|suspended|rejected
  status_reason   TEXT,
  verified        INTEGER NOT NULL DEFAULT 0,
  featured        INTEGER NOT NULL DEFAULT 0,
  followers_count INTEGER NOT NULL DEFAULT 0,
  rating_avg      REAL NOT NULL DEFAULT 0,
  rating_count    INTEGER NOT NULL DEFAULT 0,
  views_count     INTEGER NOT NULL DEFAULT 0,
  sales_count     INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

CREATE TABLE IF NOT EXISTS store_followers (
  store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (store_id, user_id)
);

-- ---------- Listings ----------
CREATE TABLE IF NOT EXISTS listings (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id          TEXT NOT NULL UNIQUE,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id           INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  category_id        INTEGER NOT NULL REFERENCES categories(id),
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  price_cents        INTEGER NOT NULL DEFAULT 0,
  currency           TEXT NOT NULL DEFAULT 'MAD',
  negotiable         INTEGER NOT NULL DEFAULT 0,
  condition          TEXT NOT NULL DEFAULT 'used_good', -- new|used_excellent|used_good|needs_repair
  city_id            INTEGER NOT NULL REFERENCES cities(id),
  area_id            INTEGER REFERENCES areas(id) ON DELETE SET NULL,
  lat                REAL,
  lng                REAL,
  attributes         TEXT,                              -- JSON: free-form specs
  contact_phone      TEXT,
  status             TEXT NOT NULL DEFAULT 'pending',   -- draft|pending|active|rejected|paused|sold|expired|deleted
  rejection_reason   TEXT,
  moderated_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  moderated_at       INTEGER,
  views_count        INTEGER NOT NULL DEFAULT 0,
  favorites_count    INTEGER NOT NULL DEFAULT 0,
  contacts_count     INTEGER NOT NULL DEFAULT 0,
  is_featured        INTEGER NOT NULL DEFAULT 0,
  featured_until     INTEGER,
  is_pinned          INTEGER NOT NULL DEFAULT 0,
  pinned_until       INTEGER,
  bumped_at          INTEGER,
  expires_at         INTEGER NOT NULL,
  published_at       INTEGER,
  created_at         INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at         INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_cat ON listings(category_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price_cents);
CREATE INDEX IF NOT EXISTS idx_listings_featured ON listings(is_featured, status);
CREATE INDEX IF NOT EXISTS idx_listings_public ON listings(public_id);

CREATE TABLE IF NOT EXISTS listing_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  thumb      TEXT,
  width      INTEGER,
  height     INTEGER,
  position   INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_listing ON listing_images(listing_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS listing_views (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  visitor_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_views_listing ON listing_views(listing_id, created_at);
CREATE INDEX IF NOT EXISTS idx_views_key ON listing_views(listing_id, visitor_key);

-- ---------- Messaging ----------
CREATE TABLE IF NOT EXISTS conversations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id      INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at INTEGER,
  last_message    TEXT,
  buyer_unread    INTEGER NOT NULL DEFAULT 0,
  seller_unread   INTEGER NOT NULL DEFAULT 0,
  buyer_archived  INTEGER NOT NULL DEFAULT 0,
  seller_archived INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_unique ON conversations(listing_id, buyer_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_conv_buyer ON conversations(buyer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_seller ON conversations(seller_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT,
  attachment      TEXT,
  read_at         INTEGER,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS blocks (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_user_id)
);

-- ---------- Trust & safety ----------
CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,          -- user|store
  target_id   INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  verified    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'visible',  -- visible|hidden
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (target_type, target_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id, status);

CREATE TABLE IF NOT EXISTS reports (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_type    TEXT NOT NULL,        -- listing|user|store|message
  target_id      INTEGER NOT NULL,
  reason         TEXT NOT NULL,
  details        TEXT,
  status         TEXT NOT NULL DEFAULT 'open',  -- open|reviewing|resolved|dismissed
  resolution_note TEXT,
  handled_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

-- ---------- Monetization ----------
CREATE TABLE IF NOT EXISTS plans (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT NOT NULL UNIQUE,
  name_ar        TEXT NOT NULL,
  name_fr        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_ar TEXT,
  description_fr TEXT,
  description_en TEXT,
  price_cents    INTEGER NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'MAD',
  duration_days  INTEGER NOT NULL DEFAULT 30,
  listing_quota  INTEGER NOT NULL DEFAULT 5,
  featured_quota INTEGER NOT NULL DEFAULT 0,
  is_store_plan  INTEGER NOT NULL DEFAULT 0,
  features       TEXT,                 -- JSON array
  active         INTEGER NOT NULL DEFAULT 1,
  sort           INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS boost_products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  type          TEXT NOT NULL,         -- feature|pin|bump
  name_ar       TEXT NOT NULL,
  name_fr       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  price_cents   INTEGER NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 7,
  active        INTEGER NOT NULL DEFAULT 1,
  sort          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS coupons (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  percent          INTEGER NOT NULL DEFAULT 0,
  amount_cents     INTEGER NOT NULL DEFAULT 0,
  max_uses         INTEGER NOT NULL DEFAULT 0,   -- 0 = unlimited
  uses             INTEGER NOT NULL DEFAULT 0,
  min_amount_cents INTEGER NOT NULL DEFAULT 0,
  starts_at        INTEGER,
  expires_at       INTEGER,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reference      TEXT NOT NULL UNIQUE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,         -- plan|boost
  plan_id        INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  boost_id       INTEGER REFERENCES boost_products(id) ON DELETE SET NULL,
  listing_id     INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  amount_cents   INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'MAD',
  coupon_id      INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending|paid|failed|refunded|cancelled
  provider       TEXT NOT NULL DEFAULT 'manual',   -- manual|cmi|payzone|stripe
  provider_ref   TEXT,
  meta           TEXT,
  created_at     INTEGER NOT NULL,
  paid_at        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id       INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  order_id      INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  starts_at     INTEGER NOT NULL,
  ends_at       INTEGER NOT NULL,
  listings_used INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active',   -- active|expired|cancelled
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id, status);

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  provider    TEXT NOT NULL,
  event       TEXT,
  payload     TEXT,
  signature_ok INTEGER NOT NULL DEFAULT 0,
  processed   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- ---------- Content & platform ----------
CREATE TABLE IF NOT EXISTS pages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title_ar    TEXT NOT NULL,
  title_fr    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  body_ar     TEXT,
  body_fr     TEXT,
  body_en     TEXT,
  published   INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS faqs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  q_ar     TEXT NOT NULL,
  a_ar     TEXT NOT NULL,
  q_fr     TEXT,
  a_fr     TEXT,
  q_en     TEXT,
  a_en     TEXT,
  sort     INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title_key  TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  data       TEXT,
  read_at    INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   INTEGER,
  meta        TEXT,
  ip          TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS activity_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  meta       TEXT,
  ip         TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);

-- Full-text search over listings (external content table)
CREATE VIRTUAL TABLE IF NOT EXISTS listings_fts USING fts5(
  title, description, content='listings', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS listings_ai AFTER INSERT ON listings BEGIN
  INSERT INTO listings_fts(rowid, title, description) VALUES (new.id, new.title, new.description);
END;
CREATE TRIGGER IF NOT EXISTS listings_ad AFTER DELETE ON listings BEGIN
  INSERT INTO listings_fts(listings_fts, rowid, title, description) VALUES('delete', old.id, old.title, old.description);
END;
CREATE TRIGGER IF NOT EXISTS listings_au AFTER UPDATE OF title, description ON listings BEGIN
  INSERT INTO listings_fts(listings_fts, rowid, title, description) VALUES('delete', old.id, old.title, old.description);
  INSERT INTO listings_fts(rowid, title, description) VALUES (new.id, new.title, new.description);
END;

-- Search analytics (popular keywords)
CREATE TABLE IF NOT EXISTS search_queries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  query      TEXT NOT NULL,
  results    INTEGER NOT NULL DEFAULT 0,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_q ON search_queries(query);
