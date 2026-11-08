import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Alert, Button } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { formatPrice, pickName } from '../lib/format.js';

export default function Pricing() {
  const { t, lang, user, toast, errorMessage } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [mine, setMine] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [busyPlan, setBusyPlan] = useState(null);
  const [listings, setListings] = useState([]);
  const [boostTarget, setBoostTarget] = useState('');

  useEffect(() => {
    api.get('/plans').then(setData).catch(() => setData({ plans: [], boosts: [] }));
    api.get('/plans/mine').then((r) => setMine(r.subscription)).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    api
      .get('/listings/mine?status=active&limit=50')
      .then((r) => {
        setListings(r.items || []);
        setBoostTarget((prev) => prev || (r.items?.[0] ? String(r.items[0].id) : ''));
      })
      .catch(() => setListings([]));
  }, [user]);

  const checkout = async (kind, code) => {
    if (!user) return navigate('/login?next=/pricing');
    if (kind === 'boost' && !boostTarget) {
      toast(t('pricing.noListings'), 'error');
      return;
    }
    setBusyPlan(code);
    try {
      const res = await api.post('/payments/checkout', {
        kind,
        plan_code: kind === 'plan' ? code : undefined,
        boost_code: kind === 'boost' ? code : undefined,
        listing_id: kind === 'boost' ? Number(boostTarget) : undefined,
        coupon: coupon.trim() || undefined,
      });
      toast(`${t('pricing.orderCreated')} — ${res.order.reference}`, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 50 }}>
      <div className="center stack" style={{ gap: 8, marginBottom: 26 }}>
        <h1 style={{ fontSize: 'clamp(1.4rem,3.6vw,2.05rem)' }}>{t('pricing.title')}</h1>
        <p className="muted" style={{ maxWidth: 560, margin: '0 auto' }}>{t('pricing.sub')}</p>
        {mine && (
          <span className="chip chip-brand" style={{ width: 'fit-content', margin: '0 auto' }}>
            <Icon name="crown" size={13} /> {t('pricing.current')}: {pickName(mine.name, lang)} · {mine.days_left}d
          </span>
        )}
      </div>

      <Alert type="info" icon="info">
        {t('pricing.notice')}
      </Alert>

      <div className="plan-grid" style={{ marginTop: 22 }}>
        {!data && [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 340 }} />)}
        {data?.plans.map((plan) => {
          const popular = plan.code === 'pro';
          const isCurrent = mine?.plan_id === plan.id;
          return (
            <div key={plan.id} className={`card plan-card ${popular ? 'popular' : ''}`}>
              {popular && <span className="chip chip-accent" style={{ width: 'fit-content' }}>{t('pricing.popular')}</span>}
              <h3 style={{ fontSize: '1.05rem' }}>
                <Link to={`/pricing/${plan.code}`} style={{ color: 'inherit' }}>{pickName(plan.name, lang)}</Link>
              </h3>
              <p className="small muted">{pickName(plan.description, lang)}</p>
              <div className="plan-price">
                {plan.price === 0 ? t('common.free') : formatPrice(plan.price, plan.currency, lang)}
                {plan.price > 0 && <small> / {plan.duration_days > 300 ? t('pricing.year') : t('pricing.month')}</small>}
              </div>
              <ul className="plan-features">
                <li><Icon name="check" size={14} /> {t('pricing.quota', { n: plan.listing_quota })}</li>
                {plan.featured_quota > 0 && <li><Icon name="check" size={14} /> {t('pricing.featuredQuota', { n: plan.featured_quota })}</li>}
                {(plan.features || []).map((f, i) => (
                  <li key={i}><Icon name="check" size={14} /> {f}</li>
                ))}
              </ul>
              <div style={{ marginTop: 'auto' }}>
                {isCurrent ? (
                  <span className="chip chip-success" style={{ width: '100%', justifyContent: 'center' }}>{t('pricing.current')}</span>
                ) : null}
                {!isCurrent && (
                  <Link to={`/pricing/${plan.code}`} className="btn btn-ghost btn-sm btn-block" style={{ marginBottom: 6 }}>
                    {t('pricing.details')}
                  </Link>
                )}
                {isCurrent ? null : plan.price === 0 ? (
                  <Link to={user ? '/post' : '/register'} className="btn btn-outline btn-block">{t('hero.cta')}</Link>
                ) : (
                  <Button
                    className="btn-block"
                    variant={popular ? undefined : 'outline'}
                    loading={busyPlan === plan.code}
                    onClick={() => checkout('plan', plan.code)}
                    type="button"
                  >
                    <Icon name="card" size={16} /> {t('pricing.choose')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h2 className="section-title"><span className="dot" /> {t('pricing.boost')}</h2>
            <p className="small muted" style={{ marginTop: 4 }}>{t('pricing.boostSub')}</p>
          </div>
        </div>
        {user && (
          <div className="card card-pad row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Icon name="pin" size={18} style={{ color: 'var(--brand-600)' }} />
            <b className="small" style={{ flex: '1 1 160px' }}>{t('pricing.pickListing')}</b>
            <select
              className="select"
              style={{ maxWidth: 280 }}
              value={boostTarget}
              onChange={(e) => setBoostTarget(e.target.value)}
              disabled={!listings.length}
            >
              {listings.length === 0 && <option value="">{t('pricing.noListings')}</option>}
              {listings.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
            {listings.length === 0 && <Link to="/post" className="btn btn-sm btn-outline">{t('nav.post')}</Link>}
          </div>
        )}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
          {data?.boosts.map((b) => (
            <div key={b.id} className="card card-pad" style={{ display: 'grid', gap: 8 }}>
              <span className="stat-icon" style={{ width: 38, height: 38 }}>
                <Icon name={b.type === 'feature' ? 'spark' : b.type === 'pin' ? 'pin' : 'bolt'} size={18} />
              </span>
              <b style={{ fontSize: '0.92rem' }}>{pickName(b.name, lang)}</b>
              <span className="tiny muted">{b.duration_days} {lang === 'ar' ? 'يوم' : lang === 'fr' ? 'jours' : 'days'}</span>
              <div className="row-between" style={{ marginTop: 4 }}>
                <b style={{ color: 'var(--brand-700)' }}>{formatPrice(b.price, 'MAD', lang)}</b>
                <Button size="sm" variant="soft" loading={busyPlan === b.code} onClick={() => checkout('boost', b.code)} type="button">
                  {t('pricing.checkout')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-sm">
        <div className="card card-pad row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Icon name="tag" size={20} style={{ color: 'var(--brand-600)' }} />
          <div style={{ flex: '1 1 200px' }}>
            <b className="small">{lang === 'ar' ? 'كود خصم' : lang === 'fr' ? 'Code promo' : 'Coupon code'}</b>
            <p className="tiny muted">{lang === 'ar' ? 'أدخل الكود قبل اختيار الباقة.' : 'Saisissez le code avant de choisir.'}</p>
          </div>
          <input className="input" style={{ maxWidth: 200 }} value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="SAVE20" dir="ltr" />
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              if (!user) return navigate('/login');
              try {
                const res = await api.post('/payments/validate-coupon', { code: coupon.trim(), amount_cents: 9900 });
                toast(`-${res.discount} MAD`, 'success');
              } catch (err) {
                toast(errorMessage(err), 'error');
              }
            }}
          >
            {t('common.apply')}
          </Button>
        </div>
      </section>
    </div>
  );
}
