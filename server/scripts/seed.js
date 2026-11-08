#!/usr/bin/env node
/**
 * Seeds reference data (cities, areas, categories, plans, boosts, content, settings)
 * and — unless --no-demo — a demo set of real accounts and listings so the
 * marketplace is browsable immediately. All data lives in the database.
 *
 * Usage: npm run db:seed [-- --reset] [--no-demo]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.DB_FILE = process.env.DB_FILE || path.resolve(__dirname, '../../data/bii3chri.db');

const { db, migrate, now } = await import('../lib/db.js');
const { config } = await import('../config.js');
const { hashPassword, randomToken, slugify } = await import('../lib/security.js');
const { logger } = await import('../lib/logger.js');
const { CITIES, AREAS, CATEGORIES, PLANS, BOOSTS, PAGES, FAQS, SETTINGS } = await import('../db/seed-data.js');

const args = new Set(process.argv.slice(2));
const RESET = args.has('--reset');
const DEMO = !args.has('--no-demo') && config.seed.demo;

if (RESET) {
  logger.warn('resetting database (all tables dropped)');
  // SQLite has no comma-separated DROP TABLE — drop each table individually.
  const tables = [
    'listings_fts', 'search_queries', 'activity_log', 'audit_log', 'contact_messages', 'settings',
    'notifications', 'faqs', 'pages', 'payment_webhooks', 'subscriptions', 'orders', 'coupons',
    'boost_products', 'plans', 'reports', 'reviews', 'blocks', 'messages', 'conversations',
    'listing_views', 'favorites', 'listing_images', 'listings', 'store_followers', 'stores',
    'categories', 'areas', 'cities', 'user_permissions', 'otp_codes', 'password_resets', 'sessions', 'users',
  ];
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const table of tables) db.exec(`DROP TABLE IF EXISTS ${table};`);
  db.exec('PRAGMA foreign_keys = ON;');
}

migrate();

/* ------------------------------ reference data ------------------------------ */

function seedCities() {
  const insertCity = db.prepare(
    `INSERT INTO cities (slug, name_ar, name_fr, name_en, region, lat, lng, active, sort)
     VALUES (@slug, @ar, @fr, @en, @region, @lat, @lng, 1, @sort)
     ON CONFLICT(slug) DO UPDATE SET name_ar=excluded.name_ar, name_fr=excluded.name_fr, name_en=excluded.name_en,
       region=excluded.region, lat=excluded.lat, lng=excluded.lng`,
  );
  const insertArea = db.prepare(
    `INSERT INTO areas (city_id, name_ar, name_fr, name_en, active)
     SELECT ?, ?, ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM areas WHERE city_id = ? AND name_ar = ?)`,
  );
  CITIES.forEach((c, i) => {
    insertCity.run({ ...c, sort: i });
    const city = db.prepare('SELECT id FROM cities WHERE slug = ?').get(c.slug);
    for (const areaName of AREAS[c.slug] || []) {
      insertArea.run(city.id, areaName, areaName, areaName, city.id, areaName);
    }
  });
  logger.info({ cities: CITIES.length }, 'cities seeded');
}

function seedCategories() {
  const insert = db.prepare(
    `INSERT INTO categories (parent_id, slug, name_ar, name_fr, name_en, icon, color, sort, active, created_at)
     VALUES (?,?,?,?,?,?,?,?,1,?)
     ON CONFLICT(slug) DO UPDATE SET name_ar=excluded.name_ar, name_fr=excluded.name_fr, name_en=excluded.name_en,
       icon=excluded.icon, color=excluded.color, sort=excluded.sort`,
  );
  CATEGORIES.forEach((cat, i) => {
    insert.run(null, cat.slug, cat.ar, cat.fr, cat.en, cat.icon, cat.color, i, now());
    const parent = db.prepare('SELECT id FROM categories WHERE slug = ?').get(cat.slug);
    (cat.children || []).forEach((child, j) => {
      insert.run(parent.id, child.slug, child.ar, child.fr, child.en, cat.icon, cat.color, j, now());
    });
  });
  logger.info({ categories: CATEGORIES.length }, 'categories seeded');
}

function seedPlans() {
  const insert = db.prepare(
    `INSERT INTO plans (code, name_ar, name_fr, name_en, description_ar, description_fr, description_en,
       price_cents, currency, duration_days, listing_quota, featured_quota, is_store_plan, features, active, sort, created_at)
     VALUES (?,?,?,?,?,?,?,?,'MAD',?,?,?,?,?,1,?,?)
     ON CONFLICT(code) DO UPDATE SET name_ar=excluded.name_ar, name_fr=excluded.name_fr, name_en=excluded.name_en,
       description_ar=excluded.description_ar, description_fr=excluded.description_fr, description_en=excluded.description_en,
       price_cents=excluded.price_cents, duration_days=excluded.duration_days, listing_quota=excluded.listing_quota,
       featured_quota=excluded.featured_quota, is_store_plan=excluded.is_store_plan, features=excluded.features, sort=excluded.sort`,
  );
  PLANS.forEach((p, i) => {
    insert.run(
      p.code, p.ar, p.fr, p.en, p.desc_ar, p.desc_fr, p.desc_en,
      p.price, p.days, p.quota, p.featured, p.store, JSON.stringify(p.features), i, now(),
    );
  });

  const insertBoost = db.prepare(
    `INSERT INTO boost_products (code, type, name_ar, name_fr, name_en, price_cents, duration_days, active, sort)
     VALUES (?,?,?,?,?,?,?,1,?)
     ON CONFLICT(code) DO UPDATE SET type=excluded.type, name_ar=excluded.name_ar, name_fr=excluded.name_fr,
       name_en=excluded.name_en, price_cents=excluded.price_cents, duration_days=excluded.duration_days, sort=excluded.sort`,
  );
  BOOSTS.forEach((b, i) => insertBoost.run(b.code, b.type, b.ar, b.fr, b.en, b.price, b.days, i));
  logger.info({ plans: PLANS.length, boosts: BOOSTS.length }, 'plans & boosts seeded');
}

function seedContent() {
  const insertPage = db.prepare(
    `INSERT INTO pages (slug, title_ar, title_fr, title_en, body_ar, body_fr, body_en, published, updated_at)
     VALUES (?,?,?,?,?,?,?,1,?)
     ON CONFLICT(slug) DO NOTHING`,
  );
  for (const p of PAGES) insertPage.run(p.slug, p.title_ar, p.title_fr, p.title_en, p.body_ar, p.body_fr, p.body_en, now());

  if (db.prepare('SELECT COUNT(*) c FROM faqs').get().c === 0) {
    const insertFaq = db.prepare(
      'INSERT INTO faqs (q_ar, a_ar, q_fr, a_fr, q_en, a_en, sort, published) VALUES (?,?,?,?,?,?,?,1)',
    );
    FAQS.forEach((f, i) => insertFaq.run(f.q_ar, f.a_ar, f.q_fr, f.a_fr, f.q_en, f.a_en, i));
  }

  const insertSetting = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)
     ON CONFLICT(key) DO NOTHING`,
  );
  for (const [k, v] of Object.entries(SETTINGS)) insertSetting.run(k, JSON.stringify(v), now());
  logger.info('content, faqs & settings seeded');
}

/* ------------------------------ accounts ------------------------------ */

function upsertUser({ name, email, phone, password, role = 'user', citySlug, bio, verified = 0, isStore = 0 }) {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const city = citySlug ? db.prepare('SELECT id FROM cities WHERE slug = ?').get(citySlug) : null;
  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO users (email, phone, password_hash, name, bio, city_id, role, status, email_verified,
                          phone_verified, verified_seller, is_store, show_phone, created_at, updated_at, last_seen_at)
       VALUES (?,?,?,?,?,?,?,'active',1,?,?,?,1,?,?,?)`,
    )
    .run(email, phone, hashPassword(password), name, bio || null, city?.id || null, role, phone ? 1 : 0, verified, isStore, ts, ts, ts);
  return Number(info.lastInsertRowid);
}

function seedStaff() {
  const adminEmail = config.seed.adminEmail;
  const adminPassword = config.seed.adminPassword || 'Admin@12345';
  const adminId = upsertUser({
    name: 'مدير المنصة',
    email: adminEmail,
    phone: null,
    password: adminPassword,
    role: 'superadmin',
    citySlug: 'casablanca',
    bio: 'إدارة منصة بيع وشري أونلاين',
  });

  upsertUser({ name: 'فريق المراجعة', email: 'moderator@bii3chri.ma', password: 'Moderator@12345', role: 'moderator', citySlug: 'rabat' });
  upsertUser({ name: 'المالية', email: 'finance@bii3chri.ma', password: 'Finance@12345', role: 'finance', citySlug: 'casablanca' });
  upsertUser({ name: 'الدعم', email: 'support@bii3chri.ma', password: 'Support@12345', role: 'support', citySlug: 'tanger' });

  logger.info({ adminEmail }, 'staff accounts ready (change passwords immediately in production)');
  return { adminId, adminEmail, adminPassword };
}

const DEMO_USERS = [
  { name: 'يوسف العلوي', email: 'youssef@demo.ma', phone: '0661000001', city: 'casablanca', bio: 'مهتم بالسيارات والإلكترونيات. بائع سريع الرد.' },
  { name: 'سلمى بناني', email: 'salma@demo.ma', phone: '0661000002', city: 'rabat', bio: 'أبيع الأثاث المستعمل بحالة ممتازة.' },
  { name: 'مهدي الإدريسي', email: 'mehdi@demo.ma', phone: '0661000003', city: 'marrakech', bio: 'متجر إلكترونيات في مراكش.' },
  { name: 'خديجة الفاسي', email: 'khadija@demo.ma', phone: '0661000004', city: 'fes', bio: 'ملابس تقليدية وعصرية.' },
  { name: 'أمين التازي', email: 'amine@demo.ma', phone: '0661000005', city: 'tanger', bio: 'أدوات مهنية وعدد يدوية.' },
  { name: 'نورة الشرقاوي', email: 'noura@demo.ma', phone: '0661000006', city: 'agadir', bio: 'منتجات أطفال وتجميل أصلية.' },
  { name: 'كريم برادة', email: 'karim@demo.ma', phone: '0661000007', city: 'meknes', bio: 'سيارات مستعملة بحالة جيدة.' },
  { name: 'هند المرابط', email: 'hind@demo.ma', phone: '0661000008', city: 'oujda', bio: 'كتب ودورات تكوينية.' },
];

const DEMO_STORES = [
  { ownerEmail: 'mehdi@demo.ma', name: 'مراكش إلكترونيك', slug: 'marrakech-electronics', city: 'marrakech', desc: 'متجر متخصص في الهواتف والحواسيب الجديدة والمستعملة بضمان المتجر. أسعار تنافسية وخدمة ما بعد البيع.' },
  { ownerEmail: 'khadija@demo.ma', name: 'خديجة أزياء', slug: 'khadija-fashion', city: 'fes', desc: 'أزياء نسائية تقليدية وعصرية، قفاطين وجلابة بأقمشة عالية الجودة وخياطة يدوية مغربية أصيلة.' },
  { ownerEmail: 'amine@demo.ma', name: 'أمين للأدوات', slug: 'amine-tools', city: 'tanger', desc: 'كل الأدوات المهنية للمهنيين والحرفيين: أدوات كهربائية، عدد يدوية، ومعدات ورشة شاملة.' },
];

/** Listing templates keep seeded content realistic and category-consistent. */
const DEMO_LISTINGS = [
  { cat: 'smartphones', city: 'casablanca', seller: 1, title: 'آيفون 14 برو ماكس 256 جيجا — حالة ممتازة', desc: 'آيفون 14 برو ماكس بذاكرة 256 جيجا، لون أسود، حالة ممتازة بدون أي خدش. البطارية 91%. معه العلبة الأصلية والشاحن. سبب البيع: تغيير الهاتف.', price: 890000, condition: 'used_excellent', featured: 1 },
  { cat: 'laptops', city: 'rabat', seller: 3, title: 'ماك بوك اير M2 13 بوصة 8 جيجا / 256', desc: 'ماك بوك اير M2 جديد لم يُستخدم، مفتوح فقط للتحقق. ضمان لمدة سنة من المتجر. مثالي للطلبة والعمل المكتبي.', price: 1250000, condition: 'new', featured: 1 },
  { cat: 'cars', city: 'casablanca', seller: 7, title: 'داسيا داستر 2019 ديزل — صيانة منتظمة', desc: 'داسيا داستر 2019، محرك ديزل 1.5، 96 ألف كيلومتر، كارط غريز كامل، صيانة دورية عند الوكيل. لا حوادث. مراقبة تقنية سارية.', price: 16500000, condition: 'used_good' },
  { cat: 'cars', city: 'meknes', seller: 7, title: 'رونو كليو 4 2017 بنزين', desc: 'رونو كليو 4 2017، بنزين 1.2، 130 ألف كم، مكيف يعمل، إطارات جديدة. البيع بسبب الانتقال للخارج. قابل للتفاوض.', price: 9800000, condition: 'used_good', negotiable: 1 },
  { cat: 'apartments-sale', city: 'marrakech', seller: 3, title: 'شقة 85م² للبيع في جليز — إقامة مغلقة', desc: 'شقة 85 متر مربع في إقامة مغلقة بحي جليز ماراكش، طابق ثاني، غرفتان وصالون ومطبخ مجهز. موقف سيارة ومسبح مشترك.', price: 145000000, condition: 'new' },
  { cat: 'living-room', city: 'rabat', seller: 2, title: 'صالون مغربي كامل خشب — 6 مقاعد', desc: 'صالون مغربي خشب صلب نخب أول، 6 مقاعد مع طاولات. الأقمشة جديدة والجلد سليم. مناسب للمنازل والرياض.', price: 1250000, condition: 'used_excellent', featured: 1 },
  { cat: 'fridges', city: 'fes', seller: 4, title: 'ثلاجة سامسونج 500 لتر No Frost', desc: 'ثلاجة سامسونج 500 لتر نظام No Frost، مستعملة سنة واحدة فقط، تعمل بشكل مثالي. سبب البيع نقل إلى منزل آخر بثلاجة مدمجة.', price: 420000, condition: 'used_excellent' },
  { cat: 'women-clothing', city: 'fes', seller: 4, title: 'قفطان مغربي مطرز يدوياً — مقاس M', desc: 'قفطان مغربي أصلي مطرز بخيوط الحرير، مطرز يدوياً في فاس. لم يُلبس إلا مرة واحدة. المقاس M، الطول 1.40م.', price: 220000, condition: 'used_excellent' },
  { cat: 'tvs', city: 'marrakech', seller: 3, title: 'تلفاز LG OLED 55 بوصة 4K', desc: 'تلفاز LG OLED 55 بوصة، 4K، ذكي بكل التطبيقات. استعمال منزلي خفيف، الصورة ممتازة، مع الريموت والعلبة.', price: 780000, condition: 'used_excellent', featured: 1 },
  { cat: 'power-tools', city: 'tanger', seller: 5, title: 'منشار دائري بوش 1400 واط + طقم أقراص', desc: 'منشار دائري بوش الأصلي 1400 واط، مع طقم 3 أقراص قطع وشنبر. مستعمل في ورشة خشب فقط، حالة ممتازة.', price: 175000, condition: 'used_good' },
  { cat: 'strollers', city: 'agadir', seller: 6, title: 'عربة أطفال شيكو 3 في 1', desc: 'عربة أطفال شيكو 3 في 1 مع كرسي سيارة وحقيبة. نظيفة جداً ومستعملة لأشهر قليلة. لون رمادي.', price: 210000, condition: 'used_excellent' },
  { cat: 'books-sale', city: 'oujda', seller: 8, title: 'كتب تحضير الباكالوريا علوم رياضية', desc: 'مجموعة كاملة من كتب التحضير للباكالوريا علوم رياضية: رياضيات، فيزياء، علوم الحياة والأرض. حالة ممتازة وبدون كتابة.', price: 25000, condition: 'used_excellent' },
  { cat: 'football', city: 'casablanca', seller: 1, title: 'طقم كرة قدم أديداس أصلي مقاس 42', desc: 'أحذية كرة قدم أديداس أصلية مقاس 42، استعملت في 3 مباريات فقط. مع علبتها. سعرها الأصلي 1200 درهم.', price: 55000, condition: 'used_excellent' },
  { cat: 'motorcycles', city: 'tanger', seller: 5, title: 'دراجة نارية سيم سيم 125 سي سي', desc: 'دراجة سيم سيم 125، 2021، 12 ألف كيلومتر، ورقة رمادية، صيانة منتظمة. كل شيء يعمل بشكل ممتاز.', price: 1780000, condition: 'used_good' },
  { cat: 'home-services', city: 'casablanca', seller: 1, title: 'خدمة تركيب وصيانة مكيفات — تغطية الدار البيضاء', desc: 'فريق تقني متخصص في تركيب وصيانة جميع أنواع المكيفات. تدخل سريع، ضمان على العمل، أسعار واضحة.', price: 30000, condition: 'new' },
  { cat: 'perfumes', city: 'agadir', seller: 6, title: 'عطر ديور سوفاج أو دو بارفان 100 مل', desc: 'عطر ديور سوفاج الأصلي 100 مل، جديد في علبته المغلفة. تم شراؤه من محل معتمد. سعر البيع أقل من السوق.', price: 95000, condition: 'new' },
  { cat: 'living-room', city: 'rabat', seller: 2, title: 'مكتب عمل خشبي مع كرسي مكتب', desc: 'مكتب خشبي 140×70 سم مع كرسي مكتب قابل للتعديل. استعمال منزلي، حالتهم جيدة جداً. البيع مع الحاجة للنقل.', price: 130000, condition: 'used_good' },
  { cat: 'consoles', city: 'casablanca', seller: 1, title: 'بلاي ستيشن 5 مع 2 يدين و 3 ألعاب', desc: 'PS5 نسخة الأقراص مع يدين DualSense و3 ألعاب (FIFA 24, Spider-Man 2, God of War). الجهاز يعمل بشكل مثالي.', price: 680000, condition: 'used_excellent', featured: 1 },
  { cat: 'tiles', city: 'fes', seller: 4, title: 'زليج مغربي تقليدي — 20 متر مربع', desc: 'زليج مغربي تقليدي من فاس، مصنوع يدوياً، 20 متر مربع، ألوان زرقاء وبيضاء. جديد لم يُستخدم.', price: 480000, condition: 'new' },
  { cat: 'freelance', city: 'marrakech', seller: 3, title: 'مطلوب مطور ويب Full Stack — عمل عن بعد', desc: 'نبحث عن مطور ويب Full Stack (React/Node) للعمل عن بعد بدوام كامل. خبرة سنتان على الأقل، راتب تنافسي حسب الخبرة.', price: 0, condition: 'new' },
  { cat: 'tablets', city: 'kenitra', seller: 2, title: 'آيباد اير 4 64 جيجا واي فاي', desc: 'آيباد اير 4، 64 جيجا، واي فاي، لون سماوي. الشاشة سليمة تماماً، مع كفر حماية وقلم غير أصلي.', price: 430000, condition: 'used_good' },
  { cat: 'fitness', city: 'settat', seller: 8, title: 'دمبل قابل للتعديل 20 كغ', desc: 'دمبل قابل للتعديل حتى 20 كيلوغرام، مستعمل قليلاً في المنزل. مع قاعدة تخزين.', price: 65000, condition: 'used_excellent' },
  { cat: 'pets', city: 'agadir', seller: 6, title: 'جراء قطة فارسية — 3 أشهر', desc: 'جراء قطة فارسية عمرها 3 أشهر، مُلقحة ومطهرة، أليفة مع الأطفال. التبني مقابل مصاريف العناية فقط.', price: 150000, condition: 'new' },
  { cat: 'school-supplies', city: 'oujda', seller: 8, title: 'محفظة مدرسية + كامل الأدوات (جديدة)', desc: 'محفظة مدرسية جديدة مع كامل الأدوات: أقلام، دفاتر، مسطرة، آلة حاسبة. لم تُستعمل، مناسبة للابتدائي.', price: 18000, condition: 'new' },
];

function seedDemo() {
  const demoUsers = [];
  for (const u of DEMO_USERS) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    demoUsers.push(
      existing?.id ??
        upsertUser({
          name: u.name,
          email: u.email,
          phone: u.phone,
          password: 'Demo@12345',
          citySlug: u.city,
          bio: u.bio,
          verified: 1,
        }),
    );
  }

  // Stores (active, verified) owned by some demo users.
  for (const s of DEMO_STORES) {
    if (db.prepare('SELECT 1 FROM stores WHERE slug = ?').get(s.slug)) continue;
    const owner = db.prepare('SELECT id FROM users WHERE email = ?').get(s.ownerEmail);
    if (!owner) continue;
    const city = db.prepare('SELECT id FROM cities WHERE slug = ?').get(s.city);
    const ts = now();
    db.prepare(
      `INSERT INTO stores (user_id, name, slug, description, city_id, status, verified, featured, followers_count,
                           rating_avg, rating_count, created_at, updated_at)
       VALUES (?,?,?,?,?,'active',1,1,?,?,?,?,?)`,
    ).run(owner.id, s.name, s.slug, s.desc, city?.id ?? null, 12 + Math.floor(Math.random() * 40), 4.6, 24, ts, ts);
    db.prepare('UPDATE users SET is_store = 1, verified_seller = 1 WHERE id = ?').run(owner.id);
  }

  const imageFor = (slug, i) => `https://picsum.photos/seed/${slug}-${i}/800/600`;

  if (db.prepare('SELECT COUNT(*) c FROM listings WHERE public_id LIKE ?').get('demo%').c === 0) {
    const insertListing = db.prepare(
      `INSERT INTO listings (public_id, user_id, store_id, category_id, title, description, price_cents, currency,
        negotiable, condition, city_id, area_id, lat, lng, status, is_featured, featured_until, views_count,
        favorites_count, contacts_count, expires_at, published_at, bumped_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,'MAD',?,?,?,?,?,?,'active',?,?,?,?,?,?,?,?,?,?)`,
    );
    const insertImage = db.prepare(
      `INSERT INTO listing_images (listing_id, path, thumb, width, height, position, is_primary, created_at)
       VALUES (?,?,?,800,600,?,?,?)`,
    );

    DEMO_LISTINGS.forEach((l, idx) => {
      const cat = db.prepare('SELECT id FROM categories WHERE slug = ?').get(l.cat);
      if (!cat) return;
      const city = db.prepare('SELECT id, lat, lng FROM cities WHERE slug = ?').get(l.city);
      const sellerId = demoUsers[l.seller - 1] || demoUsers[0];
      const store = db.prepare("SELECT id FROM stores WHERE user_id = ? AND status='active'").get(sellerId);
      const ts = now() - idx * 3 * 3600 * 1000;
      const publicId = `demo${String(idx + 1).padStart(3, '0')}${randomToken(4).replace(/[-_]/g, '').slice(0, 5)}`;
      const info = insertListing.run(
        publicId,
        sellerId,
        store?.id ?? null,
        cat.id,
        l.title,
        l.desc,
        l.price,
        l.negotiable ? 1 : 0,
        l.condition,
        city.id,
        null,
        city.lat ? city.lat + (Math.random() - 0.5) * 0.05 : null,
        city.lng ? city.lng + (Math.random() - 0.5) * 0.05 : null,
        l.featured ? 1 : 0,
        l.featured ? ts + 30 * 864e5 : null,
        40 + Math.floor(Math.random() * 900),
        Math.floor(Math.random() * 30),
        Math.floor(Math.random() * 15),
        ts + 60 * 864e5,
        ts,
        ts,
        ts,
        ts,
      );
      for (let i = 0; i < 3; i += 1) {
        const url = imageFor(l.cat, idx * 3 + i);
        insertImage.run(info.lastInsertRowid, url, url, i, i === 0 ? 1 : 0, ts);
      }
    });

    db.prepare(
      "UPDATE users SET listings_count = (SELECT COUNT(*) FROM listings WHERE user_id = users.id AND status='active')",
    ).run();
    logger.info({ listings: DEMO_LISTINGS.length }, 'demo listings created');
  }

  // A few reviews so the trust system has real data.
  if (db.prepare('SELECT COUNT(*) c FROM reviews').get().c === 0) {
    const pairs = [
      [demoUsers[1], demoUsers[0], 5, 'بائع محترم، المنتج مطابق للوصف والتعامل سريع.'],
      [demoUsers[2], demoUsers[3], 4, 'جودة جيدة والتواصل ممتاز، أنصح به.'],
      [demoUsers[4], demoUsers[2], 5, 'تعامل راقٍ، تسليم في الوقت المحدد.'],
    ];
    for (const [reviewer, target, rating, comment] of pairs) {
      db.prepare(
        `INSERT OR IGNORE INTO reviews (target_type, target_id, reviewer_id, rating, comment, verified, status, created_at, updated_at)
         VALUES ('user', ?, ?, ?, ?, 1, 'visible', ?, ?)`,
      ).run(target, reviewer, rating, comment, now(), now());
    }
    for (const u of demoUsers) {
      const agg = db.prepare("SELECT COUNT(*) c, COALESCE(AVG(rating),0) a FROM reviews WHERE target_type='user' AND target_id=? AND status='visible'").get(u);
      db.prepare('UPDATE users SET rating_avg = ?, rating_count = ? WHERE id = ?').run(agg.a, agg.c, u);
    }
    logger.info('demo reviews created');
  }

  seedOperations(demoUsers);

  logger.info('demo accounts ready — password: Demo@12345');
  return demoUsers;
}

/**
 * Operational demo data so every staff portal (finance, support, moderation)
 * opens with real work in it instead of empty tables.
 */
function seedOperations(demoUsers) {
  const ts = now();
  const day = 864e5;
  const [owner] = demoUsers;

  // A couple of fresh listings waiting for moderation + one full report queue.
  const pendingTemplate = [
    { cat: 'smartphones', title: 'سامسونج جالاكسي S23 ألترا 256 جيجا', price: 720000, city: 'casablanca' },
    { cat: 'laptops', title: 'لينوفو ثينك باد i5 الجيل العاشر', price: 480000, city: 'rabat' },
    { cat: 'motorcycles', title: 'دراجة هوندا 125 موديل 2020', price: 1950000, city: 'fes' },
  ];
  if (db.prepare("SELECT COUNT(*) c FROM listings WHERE status='pending'").get().c === 0) {
    for (const [i, tpl] of pendingTemplate.entries()) {
      const cat = db.prepare('SELECT id FROM categories WHERE slug = ?').get(tpl.cat);
      const city = db.prepare('SELECT id FROM cities WHERE slug = ?').get(tpl.city);
      if (!cat || !city) continue;
      const seller = demoUsers[(i + 1) % demoUsers.length];
      db.prepare(
        `INSERT INTO listings (public_id, user_id, category_id, title, description, price_cents, currency, condition,
          city_id, status, views_count, expires_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,'MAD','used_good',?,'pending',0,?,?,?)`,
      ).run(
        `demo-pending-${i + 1}`,
        seller,
        cat.id,
        tpl.title,
        'إعلان جديد بانتظار مراجعة فريق الإشراف قبل النشر. الوصف كامل والصور مرفقة من البائع.',
        tpl.price,
        city.id,
        ts + 60 * day,
        ts - (i + 1) * 3600 * 1000,
        ts - (i + 1) * 3600 * 1000,
      );
    }
    logger.info({ pending: pendingTemplate.length }, 'pending listings queued for moderation');
  }

  // Stores waiting for moderation + one suspended, so the stash of store tools is exercised.
  if (db.prepare("SELECT COUNT(*) c FROM stores WHERE status != 'active'").get().c === 0) {
    const pendingStores = [
      { ownerEmail: 'noura@demo.ma', name: 'نورة لمنتجات الأطفال', slug: 'noura-kids', city: 'agadir', status: 'pending', verified: 0, desc: 'متجر متخصص في منتجات الأطفال ومستلزمات التجميل الأصلية بأسعار مناسبة وضمان الاسترجاع.' },
      { ownerEmail: 'hind@demo.ma', name: 'مكتبة هند', slug: 'hind-books', city: 'oujda', status: 'pending', verified: 0, desc: 'كتب مدرسية وجامعية ودورات تكوينية، توصيل لجميع المدن مع إمكانية الدفع عند الاستلام.' },
      { ownerEmail: 'karim@demo.ma', name: 'كريم للسيارات', slug: 'karim-cars', city: 'meknes', status: 'suspended', verified: 0, desc: 'وسيط بيع سيارات مستعملة بالتقسيط، مع فحص تقني قبل البيع واستشارة مجانية.' },
    ];
    for (const [i, st] of pendingStores.entries()) {
      if (db.prepare('SELECT 1 FROM stores WHERE slug = ?').get(st.slug)) continue;
      const owner = db.prepare('SELECT id FROM users WHERE email = ?').get(st.ownerEmail);
      const city = db.prepare('SELECT id FROM cities WHERE slug = ?').get(st.city);
      if (!owner) continue;
      db.prepare(
        `INSERT INTO stores (user_id, name, slug, description, city_id, status, verified, featured, followers_count,
                             rating_avg, rating_count, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,0,0,0,0,?,?)`,
      ).run(owner.id, st.name, st.slug, st.desc, city?.id ?? null, st.status, st.verified, ts - (i + 1) * day, ts - (i + 1) * day);
    }
    logger.info('pending/suspended stores queued for moderation');
  }

  if (db.prepare('SELECT COUNT(*) c FROM reports').get().c === 0) {
    const activeListings = db.prepare("SELECT id FROM listings WHERE status='active' ORDER BY id LIMIT 6").all();
    const reasons = [
      ['scam', 'السعر منخفض جداً ويطلب الدفع مقدماً عبر تحويل بنكي.', 'open'],
      ['wrong_category', 'الإعلان منشور في تصنيف غير مناسب.', 'open'],
      ['duplicate', 'نفس الإعلان منشور عدة مرات.', 'reviewing'],
      ['counterfeit', 'المنتج يبدو مقلداً وليس أصلياً.', 'resolved'],
    ];
    reasons.forEach(([reason, details, status], i) => {
      const target = activeListings[i % activeListings.length];
      if (!target) return;
      db.prepare(
        `INSERT INTO reports (reporter_id, target_type, target_id, reason, details, status, created_at, updated_at)
         VALUES (?, 'listing', ?, ?, ?, ?, ?, ?)`,
      ).run(demoUsers[(i + 2) % demoUsers.length], target.id, reason, details, status, ts - i * 6 * 3600e3, ts - i * 6 * 3600e3);
    });
    logger.info('demo reports created');
  }

  // Support inbox: a few unanswered contact-form messages.
  if (db.prepare('SELECT COUNT(*) c FROM contact_messages').get().c === 0) {
    const messages = [
      ['سلمى بناني', 'salma@demo.ma', 'استرجاع كلمة المرور', 'نسيت كلمة المرور ولم يصلني رابط الاستعادة. ماذا أفعل؟', 'new'],
      ['كريم برادة', 'karim@demo.ma', 'سؤال حول الباقة الاحترافية', 'هل يمكنني ترقية باقتي في منتصف الشهر؟ وهل تُحسب المدة المتبقية؟', 'new'],
      ['هند المرابط', 'hind@demo.ma', 'إعلان مرفوض', 'تم رفض إعلاني دون سبب واضح، أرجو التوضيح لأصحح الإعلان.', 'open'],
      ['أمين التازي', 'amine@demo.ma', 'مشكلة في رفع الصور', 'عند رفع أكثر من 3 صور تظهر رسالة خطأ. جربت من الهاتف والحاسوب.', 'answered'],
    ];
    messages.forEach(([name, email, subject, message, status], i) => {
      db.prepare('INSERT INTO contact_messages (name, email, subject, message, status, created_at) VALUES (?,?,?,?,?,?)').run(
        name, email, subject, message, status, ts - i * 9 * 3600e3,
      );
    });
    logger.info('demo support inbox created');
  }

  // Finance: paid plan order + active subscription, one pending order, one boost.
  if (db.prepare('SELECT COUNT(*) c FROM orders').get().c === 0) {
    const pro = db.prepare("SELECT * FROM plans WHERE code='pro'").get();
    const boost = db.prepare("SELECT * FROM boost_products WHERE code='feature-7'").get();
    const listing = db.prepare("SELECT id FROM listings WHERE user_id = ? AND status='active' LIMIT 1").get(owner);
    const mkRef = (i) => `BC-DEMO${String(i + 1).padStart(4, '0')}`;

    if (pro) {
      db.prepare(
        `INSERT INTO orders (reference, user_id, kind, plan_id, amount_cents, currency, status, provider, provider_ref, created_at, paid_at)
         VALUES (?,?, 'plan', ?,?, 'MAD', 'paid', 'manual', 'seed', ?, ?)`,
      ).run(mkRef(0), owner, pro.id, pro.price_cents, ts - 9 * day, ts - 9 * day);
      db.prepare(
        `INSERT INTO subscriptions (user_id, plan_id, starts_at, ends_at, listings_used, status, created_at)
         VALUES (?,?,?,?,0,'active',?)`,
      ).run(owner, pro.id, ts - 9 * day, ts + (pro.duration_days - 9) * day, ts - 9 * day);
    }
    if (boost && listing) {
      db.prepare(
        `INSERT INTO orders (reference, user_id, kind, boost_id, listing_id, amount_cents, currency, status, provider, provider_ref, created_at, paid_at)
         VALUES (?,?, 'boost', ?, ?, ?, 'MAD', 'paid', 'manual', 'seed', ?, ?)`,
      ).run(mkRef(1), owner, boost.id, listing.id, boost.price_cents, ts - 4 * day, ts - 4 * day);
      db.prepare('UPDATE listings SET is_featured = 1, featured_until = ? WHERE id = ?').run(ts + boost.duration_days * day, listing.id);
    }
    const business = db.prepare("SELECT * FROM plans WHERE code='business'").get();
    if (business) {
      db.prepare(
        `INSERT INTO orders (reference, user_id, kind, plan_id, amount_cents, currency, status, provider, created_at)
         VALUES (?,?, 'plan', ?,?, 'MAD', 'pending', 'manual', ?)`,
      ).run(mkRef(2), demoUsers[1], business.id, business.price_cents, ts - 2 * day);
    }
    logger.info('demo orders & subscriptions created');
  }

  // Search analytics.
  if (db.prepare('SELECT COUNT(*) c FROM search_queries').get().c === 0) {
    const terms = [
      ['iphone', 42], ['سيارة', 31], ['شقة', 27], ['laptop', 22], ['دراجة', 18],
      ['آيفون 14', 15], ['samsung', 12], ['sofa', 9], ['بلاي ستيشن', 8], ['tangier apartment', 0],
      ['yamaha r6', 0], ['macbook m3', 6], ['قفطان', 5], ['frigo', 4], ['trottinette electrique', 0],
    ];
    const insert = db.prepare('INSERT INTO search_queries (query, results, user_id, created_at) VALUES (?,?,?,?)');
    db.transaction(() => {
      terms.forEach(([query, results], i) => {
        const hits = Math.max(1, Math.round(results / 6));
        for (let h = 0; h < hits; h += 1) {
          insert.run(query, results, h % 3 === 0 ? demoUsers[h % demoUsers.length] : null, ts - (i + h) * 5 * 3600e3);
        }
      });
    })();
    logger.info('demo search queries created');
  }

  // Payment webhook log (one accepted, one rejected delivery) — payments stay off.
  if (db.prepare('SELECT COUNT(*) c FROM payment_webhooks').get().c === 0) {
    const insert = db.prepare(
      'INSERT INTO payment_webhooks (provider, event, payload, signature_ok, processed, created_at) VALUES (?,?,?,?,?,?)',
    );
    insert.run('stripe', 'checkout.session.completed', JSON.stringify({ id: 'evt_demo_1', type: 'checkout.session.completed', data: { object: { client_reference_id: 'BC-DEMO0001', amount_total: 9900 } } }), 1, 1, ts - 9 * day);
    insert.run('stripe', 'checkout.session.completed', JSON.stringify({ id: 'evt_demo_2', type: 'checkout.session.completed', error: 'signature mismatch' }), 0, 0, ts - 3 * day);
    insert.run('cmi', 'APPROVED', JSON.stringify({ PROCESSAUTH: 'demo', amount: 249 }), 0, 0, ts - 2 * day);
    logger.info('demo webhook log created');
  }

  // Audit trail + a broadcast notification so the audit page is meaningful.
  if (db.prepare('SELECT COUNT(*) c FROM audit_log').get().c === 0) {
    const staff = db.prepare("SELECT id, role FROM users WHERE role IN ('superadmin','moderator','finance','support')").all();
    const insert = db.prepare(
      'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, meta, ip, created_at) VALUES (?,?,?,?,?,?,?)',
    );
    const events = [
      ['listing.approved', 'listing', 1],
      ['listing.rejected', 'listing', 2],
      ['user.status_changed', 'user', 5],
      ['order.marked_paid', 'order', 1],
      ['setting.updated', 'setting', null],
      ['report.resolved', 'report', 1],
    ];
    events.forEach(([action, entity, id], i) => {
      const actor = staff[i % staff.length];
      if (!actor) return;
      insert.run(actor.id, action, entity, id, JSON.stringify({ seed: true }), '127.0.0.1', ts - i * 4 * 3600e3);
    });
    logger.info('demo audit entries created');
  }
}

/* ------------------------------ run ------------------------------ */

seedCities();
seedCategories();
seedPlans();
seedContent();
const staff = seedStaff();
if (DEMO) seedDemo();

const summary = {
  users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  cities: db.prepare('SELECT COUNT(*) c FROM cities').get().c,
  categories: db.prepare('SELECT COUNT(*) c FROM categories').get().c,
  listings: db.prepare('SELECT COUNT(*) c FROM listings').get().c,
  plans: db.prepare('SELECT COUNT(*) c FROM plans').get().c,
};
logger.info(summary, 'seed complete');
if (!config.seed.adminPassword) {
  console.log('\n──────────────────────────────────────────────');
  console.log(' Super admin:', staff.adminEmail);
  console.log(' Password   :', staff.adminPassword, '(change it immediately)');
  console.log('──────────────────────────────────────────────\n');
}
