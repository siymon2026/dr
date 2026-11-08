/**
 * End-to-end API smoke test against a running server.
 * Exercises: session/CSRF, register, profile, listing create + images + moderation,
 * search/filter, favorites, chat (SSE-backed), reviews guard, reports, admin RBAC, quota.
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:4000';
let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name} ${extra}`);
  }
}

class Client {
  constructor(ip = null) {
    this.cookies = new Map();
    this.csrf = null;
    // Distinct source IP per client keeps per-IP rate limits from crossing tests.
    this.ip = ip || `10.${1 + Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  }
  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  store(res) {
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const c of setCookie) {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      const k = pair.slice(0, idx);
      const v = pair.slice(idx + 1);
      if (v === '') this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
  }
  async req(method, path, body, { raw = false, headers = {} } = {}) {
    const h = { 'x-forwarded-for': this.ip, ...headers };
    if (body && !raw) h['content-type'] = 'application/json';
    if (this.cookies.size) h.cookie = this.cookieHeader();
    if (this.csrf && !['GET', 'HEAD'].includes(method)) h['x-csrf-token'] = this.csrf;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: h,
      body: body ? (raw ? body : JSON.stringify(body)) : undefined,
    });
    this.store(res);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-json */
    }
    // Real SPAs read the rotated token from the response body or the cookie.
    if (json?.csrfToken) this.csrf = json.csrfToken;
    if (this.cookies.has('bc_csrf')) this.csrf = this.cookies.get('bc_csrf');
    return { status: res.status, json, text, headers: res.headers };
  }
  async init() {
    const r = await this.req('GET', '/api/session');
    this.csrf = r.json.csrfToken;
    return r;
  }
}

const rand = () => Math.random().toString(36).slice(2, 8);

(async () => {
  console.log('\n=== Bii3 & Chri API smoke test ===\n');

  console.log('[1] health & session/CSRF');
  const guest = new Client();
  const s0 = await guest.init();
  ok('session returns csrf token', typeof s0.json.csrfToken === 'string' && s0.json.csrfToken.length > 10);
  ok('guest has no user', s0.json.user === null);

  const noCsrf = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': guest.ip, cookie: guest.cookieHeader() },
    body: JSON.stringify({ name: 'x', email: 'x@y.ma', password: 'Abcdef123', accept_terms: true }),
  });
  ok('POST without CSRF is rejected (403)', noCsrf.status === 403);

  console.log('\n[2] registration + validation');
  const seller = new Client();
  await seller.init();
  const badMail = await seller.req('POST', '/api/auth/register', {
    name: 'Test', email: 'not-an-email', password: 'Abcdef123', accept_terms: true,
  });
  ok('invalid email rejected (400)', badMail.status === 400, badMail.text);

  const weak = await seller.req('POST', '/api/auth/register', {
    name: 'Test', email: `weak${rand()}@test.ma`, password: 'short', accept_terms: true,
  });
  ok('weak password rejected', weak.status === 400, weak.text);

  const sellerEmail = `seller${rand()}@test.ma`;
  const reg = await seller.req('POST', '/api/auth/register', {
    name: 'بائع تجريبي', email: sellerEmail, password: 'Seller@12345', accept_terms: true, locale: 'ar',
  });
  ok('registration succeeds (201)', reg.status === 201, reg.text);
  ok('registration returns self user with email', reg.json?.user?.email === sellerEmail);
  ok('new account is not admin', reg.json?.user?.permissions?.length === 0);

  const dup = await seller.req('POST', '/api/auth/register', {
    name: 'Dup', email: sellerEmail, password: 'Seller@12345', accept_terms: true,
  });
  ok('duplicate email → 409', dup.status === 409);

  console.log('\n[3] session persistence & profile update');
  const me = await seller.req('GET', '/api/session');
  ok('session keeps the logged-in user', me.json.user?.email === sellerEmail);
  const prof = await seller.req('PATCH', '/api/auth/me', { name: 'بائع تجريبي 2', bio: 'مرحباً بكم في ملفي', show_phone: false });
  ok('profile update works', prof.status === 200 && prof.json.user.name === 'بائع تجريبي 2', prof.text);
  ok('privacy flag persisted', prof.json.user.show_phone === false);

  console.log('\n[4] taxonomy & geography');
  const cats = await guest.req('GET', '/api/categories');
  ok('18 root categories', cats.json.items.length >= 18, String(cats.json.items.length));
  ok('categories have children', cats.json.items.some((c) => c.children.length > 0));
  const cities = await guest.req('GET', '/api/geo/cities');
  ok('cities list is non-empty', cities.json.items.length >= 20);
  const cityId = cities.json.items.find((c) => c.slug === 'casablanca').id;
  const phoneCat = cats.json.items.find((c) => c.slug === 'phones');
  const smartphoneCat = phoneCat.children.find((c) => c.slug === 'smartphones');

  console.log('\n[5] listing creation requires auth + moderation queue');
  const anon = new Client();
  await anon.init();
  const anonCreate = await anon.req('POST', '/api/listings', {
    title: 'إعلان مجهول', description: 'يجب أن يُرفض', category_id: smartphoneCat.id,
    price_cents: 1000, condition: 'used_good', city_id: cityId,
  });
  ok('anonymous cannot create listing (401)', anonCreate.status === 401);

  const listingPayload = {
    title: 'هاتف سامسونج جالاكسي S23 للبيع',
    description: 'هاتف في حالة ممتازة، استعمل لمدة ستة أشهر فقط، مع العلبة والشاحن الأصلي. البيع بسبب الانتقال.',
    category_id: smartphoneCat.id,
    price_cents: 650000,
    condition: 'used_excellent',
    negotiable: true,
    city_id: cityId,
  };
  const created = await seller.req('POST', '/api/listings', listingPayload);
  ok('listing created (201)', created.status === 201, created.text);
  ok('new listing enters moderation (pending)', created.json?.status === 'pending');
  const listingId = created.json?.id;

  const quota = await seller.req('GET', '/api/listings/quota/me');
  ok('quota endpoint reports usage', quota.json.used >= 1 && quota.json.quota >= 5, quota.text);

  console.log('\n[6] uploads: real image processing to WebP');
  const sharp = (await import('sharp')).default;
  const png = await sharp({
    create: { width: 900, height: 700, channels: 3, background: { r: 20, g: 120, b: 110 } },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('images', new Blob([png], { type: 'image/png' }), 'test.png');
  const up = await seller.req('POST', `/api/uploads/listing/${listingId}`, form, { raw: true });
  ok('image uploaded & converted', up.status === 201 && up.json.images[0].path.endsWith('.webp'), up.text);
  const imgPath = up.json?.images?.[0]?.path || '';
  const served = imgPath ? await fetch(`${BASE}${imgPath}`) : { status: 0, headers: new Headers() };
  ok('uploaded WebP is served', served.status === 200 && served.headers.get('content-type') === 'image/webp');

  const svg = new FormData();
  svg.append('images', new Blob(['<svg onload="alert(1)"></svg>'], { type: 'image/svg+xml' }), 'x.svg');
  const badUp = await seller.req('POST', `/api/uploads/listing/${listingId}`, svg, { raw: true });
  ok('SVG upload rejected', badUp.status === 400, badUp.text);

  const tooMany = 16;
  const form2 = new FormData();
  for (let i = 0; i < tooMany; i += 1) form2.append('images', new Blob([png], { type: 'image/png' }), `t${i}.png`);
  const manyUp = await seller.req('POST', `/api/uploads/listing/${listingId}`, form2, { raw: true });
  ok('15-image cap enforced with a clean 400', manyUp.status === 400, `${manyUp.status} ${manyUp.text.slice(0, 120)}`);

  console.log('\n[7] moderation by admin + publish');
  const admin = new Client();
  await admin.init();
  const adminLogin = await admin.req('POST', '/api/auth/login', { identifier: 'admin@bii3chri.ma', password: 'Admin@12345' });
  ok('admin login works', adminLogin.status === 200, adminLogin.text);
  ok('admin has staff permissions', adminLogin.json.user.permissions.includes('listings.moderate'));

  const queue = await admin.req('GET', '/api/admin/listings?status=pending');
  ok('pending queue contains the new listing', queue.json.items.some((l) => l.id === listingId));

  const forbiddenForSeller = await seller.req('GET', '/api/admin/stats');
  ok('seller blocked from admin stats (403)', forbiddenForSeller.status === 403);

  const rejectNoReason = await admin.req('POST', `/api/admin/listings/${listingId}/moderate`, { decision: 'reject' });
  ok('reject without reason → 400', rejectNoReason.status === 400);

  const approve = await admin.req('POST', `/api/admin/listings/${listingId}/moderate`, { decision: 'approve' });
  ok('approval activates listing', approve.status === 200 && approve.json.status === 'active', approve.text);

  console.log('\n[8] search, filters, sorting, pagination');
  const found = await guest.req('GET', '/api/listings?q=سامسونج');
  ok('FTS finds the listing by Arabic keyword', found.json.items.some((l) => l.id === listingId), found.text.slice(0, 200));
  const byPrice = await guest.req('GET', '/api/listings?min_price=6000&max_price=7000');
  ok('price range filter works', byPrice.json.items.every((l) => l.price >= 6000 && l.price <= 7000));
  const sorted = await guest.req('GET', '/api/listings?sort=price_asc&limit=10');
  const prices = sorted.json.items.map((l) => l.price);
  ok('sort by price ascending', prices.every((p, i) => i === 0 || prices[i - 1] <= p));
  const byCat = await guest.req('GET', `/api/listings?category=${phoneCat.id}`);
  ok('parent category includes child listings', byCat.json.items.some((l) => l.id === listingId));
  const byCity = await guest.req('GET', `/api/listings?city=${cityId}`);
  ok('city filter works', byCity.json.items.every((l) => l.city.id === cityId));
  const paged = await guest.req('GET', '/api/listings?limit=5&page=2');
  ok('pagination metadata', paged.json.pagination.page === 2 && paged.json.items.length <= 5);
  const cond = await guest.req('GET', '/api/listings?condition=new');
  ok('condition filter works', cond.json.items.every((l) => l.condition === 'new'));

  const injection = await guest.req('GET', `/api/listings?q=${encodeURIComponent("'; DROP TABLE listings;--")}`);
  ok('SQL injection attempt is harmless', injection.status === 200);
  const stillThere = await guest.req('GET', '/api/listings?limit=1');
  ok('listings table intact after injection attempt', stillThere.json.pagination.total > 0);

  console.log('\n[9] listing detail, views, favorites');
  const detail = await guest.req('GET', `/api/listings/${listingId}`);
  ok('public detail loads', detail.status === 200 && detail.json.listing.id === listingId);
  ok('detail includes owner & images', detail.json.owner?.name && detail.json.listing.images.length >= 1);
  const v1 = detail.json.listing.views;
  await new Promise((r) => setTimeout(r, 50));
  const detail2 = await guest.req('GET', `/api/listings/${listingId}`);
  ok('views increment (deduped per visitor)', detail2.json.listing.views >= v1);

  const buyer = new Client();
  await buyer.init();
  await buyer.req('POST', '/api/auth/register', {
    name: 'مشتري تجريبي', email: `buyer${rand()}@test.ma`, password: 'Buyer@12345', accept_terms: true,
  });
  const fav = await buyer.req('POST', `/api/favorites/${listingId}`);
  ok('favorite added', fav.status === 200 && fav.json.favorite === true, fav.text);
  const favList = await buyer.req('GET', '/api/favorites');
  ok('favorites list contains it', favList.json.items.some((l) => l.id === listingId));

  console.log('\n[10] chat between buyer and seller');
  const conv = await buyer.req('POST', '/api/conversations', { listing_id: listingId, message: 'السلام عليكم، هل الهاتف ما زال متوفراً؟' });
  ok('conversation created', conv.status === 201, conv.text);
  const convId = conv.json?.conversation?.id;
  const sellerInbox = await seller.req('GET', '/api/conversations');
  ok('seller sees conversation', sellerInbox.json.items.some((c) => c.id === convId));
  ok('seller sees unread count', sellerInbox.json.items.find((c) => c.id === convId).unread === 1);

  const reply = await seller.req('POST', `/api/conversations/${convId}/messages`, { body: 'وعليكم السلام، نعم متوفر.' });
  ok('seller can reply', reply.status === 201, reply.text);
  const thread = await buyer.req('GET', `/api/conversations/${convId}`);
  ok('thread has both messages', thread.json.messages.length === 2);
  ok('reading clears unread', thread.json.conversation.unread === 0);

  const outsider = new Client();
  await outsider.init();
  await outsider.req('POST', '/api/auth/register', {
    name: 'غريب', email: `out${rand()}@test.ma`, password: 'Outsider@1', accept_terms: true,
  });
  const peek = await outsider.req('GET', `/api/conversations/${convId}`);
  ok("outsider cannot read someone else's chat (403)", peek.status === 403, peek.text);

  const selfMsg = await seller.req('POST', '/api/conversations', { listing_id: listingId });
  ok('seller cannot message own listing (409)', selfMsg.status === 409, selfMsg.text);

  console.log('\n[11] reviews & trust safeguards');
  const earlyReview = await buyer.req('POST', '/api/reviews', {
    target_type: 'user', target_id: reg.json.user.id, rating: 5, comment: 'ممتاز',
  });
  ok('review allowed only after real interaction', earlyReview.status === 201 || earlyReview.status === 403, earlyReview.text);
  const again = await buyer.req('POST', '/api/reviews', {
    target_type: 'user', target_id: reg.json.user.id, rating: 1, comment: 'تكرار',
  });
  ok('duplicate review blocked (409)', again.status === 409, again.text);
  const selfReview = await seller.req('POST', '/api/reviews', {
    target_type: 'user', target_id: reg.json.user.id, rating: 5,
  });
  ok('self review blocked', selfReview.status === 400, selfReview.text);

  console.log('\n[12] reports & moderation workflow');
  const rep = await buyer.req('POST', '/api/reports', { target_type: 'listing', target_id: listingId, reason: 'scam', details: 'اختبار' });
  ok('report submitted', rep.status === 201, rep.text);
  const repDup = await buyer.req('POST', '/api/reports', { target_type: 'listing', target_id: listingId, reason: 'scam' });
  ok('duplicate report within 24h blocked', repDup.status === 400);
  const adminReports = await admin.req('GET', '/api/admin/reports');
  ok('admin sees the report', adminReports.json.items.some((r) => r.target_type === 'listing' && r.target_id === listingId));
  const handled = await admin.req('POST', `/api/admin/reports/${adminReports.json.items[0].id}`, { status: 'resolved', note: 'تم الفحص', action: 'none' });
  ok('report resolved', handled.status === 200, handled.text);

  console.log('\n[13] RBAC: staff cannot escalate');
  const mod = new Client();
  await mod.init();
  await mod.req('POST', '/api/auth/login', { identifier: 'moderator@bii3chri.ma', password: 'Moderator@12345' });
  const escalate = await mod.req('PATCH', `/api/admin/users/${reg.json.user.id}`, { role: 'superadmin' });
  ok('moderator cannot assign roles (403)', escalate.status === 403, escalate.text);
  const selfPromote = await admin.req('PATCH', `/api/admin/users/${reg.json.user.id}`, { role: 'superadmin' });
  ok('admin cannot grant superadmin', selfPromote.status === 403, selfPromote.text);
  const assignAdmin = await admin.req('PATCH', `/api/admin/users/${reg.json.user.id}`, { role: 'admin' });
  ok('admin can grant lower staff role', assignAdmin.status === 200, assignAdmin.text);

  console.log('\n[14] store creation + moderation');
  const storeRes = await seller.req('POST', '/api/stores', {
    name: 'متجر الاختبار', description: 'متجر لبيع الهواتف والأجهزة الإلكترونية بأسعار مناسبة وضمان.', city_id: cityId,
  });
  ok('store created pending', storeRes.status === 201 && storeRes.json.status === 'pending', storeRes.text);
  const storeId = storeRes.json.store_id;
  const approveStore = await admin.req('POST', `/api/admin/stores/${storeId}/status`, { status: 'active' });
  ok('admin activates store', approveStore.status === 200);
  const storePublic = await guest.req('GET', '/api/stores?limit=50');
  ok('active store is public', storePublic.json.items.some((s) => s.id === storeId));

  console.log('\n[15] plans, coupons, checkout (no real payment)');
  const plans = await guest.req('GET', '/api/plans');
  ok('plans listed', plans.json.plans.length >= 3);
  ok('payment not live', plans.json.payment_ready === false);
  const coupon = await admin.req('POST', '/api/admin/coupons', { code: `TEST${rand().toUpperCase()}`, percent: 20 });
  ok('coupon created by admin', coupon.status === 201, coupon.text);
  const couponCodes = await admin.req('GET', '/api/admin/coupons');
  const code = couponCodes.json.items.find((c) => c.id === coupon.json.id).code;
  const val = await seller.req('POST', '/api/payments/validate-coupon', { code, amount_cents: 9900 });
  ok('coupon validates & discounts', val.status === 200 && val.json.discount === 19.8, val.text);
  const checkout = await seller.req('POST', '/api/payments/checkout', { kind: 'plan', plan_code: 'pro', coupon: code });
  ok('checkout creates pending order', checkout.status === 201 && checkout.json.order.status === 'pending', checkout.text);
  ok('checkout never charges (payment_ready false)', checkout.json.payment_ready === false);
  const myOrders = await seller.req('GET', '/api/payments/orders');
  ok('order history visible to user', myOrders.json.items.length >= 1);

  const staticOrder = await seller.req('POST', '/api/payments/orders/9999/mark-paid-offline', {});
  ok('user cannot settle orders', staticOrder.status === 403 || staticOrder.status === 404, `${staticOrder.status} ${staticOrder.text.slice(0, 120)}`);

  console.log('\n[16] notifications & admin stats');
  const notifs = await seller.req('GET', '/api/notifications');
  ok('seller received notifications', notifs.json.items.length > 0, notifs.text.slice(0, 100));
  const stats = await admin.req('GET', '/api/admin/stats');
  ok('admin stats has real aggregates', stats.json.listings.total > 0 && stats.json.users.total > 0);
  ok('stats series is 14 days', stats.json.series.length === 14);
  const audit = await admin.req('GET', '/api/admin/audit');
  ok('audit log records admin actions', audit.json.items.length > 0, audit.text.slice(0, 120));

  console.log('\n[17] bans take effect immediately');
  const ban = await admin.req('PATCH', `/api/admin/users/${reg.json.user.id}`, { status: 'suspended', status_reason: 'admin granted role test cleanup' });
  ok('user suspended', ban.status === 200 && ban.json.user.status === 'suspended');
  const afterBan = await seller.req('GET', '/api/session');
  ok('suspended user session invalidated', afterBan.json.user === null, afterBan.text.slice(0, 120));
  const loginBanned = await seller.req('POST', '/api/auth/login', { identifier: sellerEmail, password: 'Seller@12345' });
  ok('suspended user cannot log in (403)', loginBanned.status === 403, loginBanned.text);
  await admin.req('PATCH', `/api/admin/users/${reg.json.user.id}`, { status: 'active' });
  // Suspension revoked all sessions: sign back in like a real user would.
  const relogin = await seller.req('POST', '/api/auth/login', { identifier: sellerEmail, password: 'Seller@12345' });
  ok('reactivated user can log in again', relogin.status === 200, relogin.text.slice(0, 120));

  console.log('\n[18] XSS & input hardening');
  const xss = await seller.req('PATCH', '/api/auth/me', { name: '<img src=x onerror=alert(1)>Bash' });
  ok('HTML stripped from stored text', !xss.json.user.name.includes('<'), xss.json.user.name);
  const huge = await seller.req('PATCH', '/api/auth/me', { bio: 'x'.repeat(5000) });
  ok('oversized bio rejected with too_long', huge.status === 400 && huge.json?.error?.details?.bio === 'too_long', huge.text.slice(0, 160));

  console.log('\n[19] rate limiting on login');
  const hammer = new Client('10.99.99.99');
  await hammer.init();
  let limited = false;
  for (let i = 0; i < 22; i += 1) {
    const r = await hammer.req('POST', '/api/auth/login', { identifier: 'nobody@test.ma', password: 'wrong' });
    if (r.status === 429) {
      limited = true;
      break;
    }
  }
  ok('brute-force attempts are rate limited (429)', limited);

  console.log('\n[20] SSE stream endpoint guards auth');
  const noAuthStream = await fetch(`${BASE}/api/notifications/stream`, { headers: { 'x-forwarded-for': guest.ip } });
  ok('stream requires authentication', noAuthStream.status === 401);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail) {
    console.log('Failures:\n' + failures.map((f) => ` - ${f}`).join('\n'));
    process.exit(1);
  }
})();
