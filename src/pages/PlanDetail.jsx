import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Alert, Button, EmptyState } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { formatNumber, formatPrice, pickName } from '../lib/format.js';

/** Public detail page for a subscription plan (`/pricing/:code`). */
export default function PlanDetail() {
  const { t, lang, user, toast, errorMessage } = useApp();
  const { code } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [missing, setMissing] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPlan(null);
    setMissing(false);
    api
      .get(`/plans/${encodeURIComponent(code)}`)
      .then((r) => setPlan(r.plan))
      .catch(() => setMissing(true));
  }, [code]);

  const checkout = async () => {
    if (!user) return navigate(`/login?next=${encodeURIComponent(`/pricing/${code}`)}`);
    setBusy(true);
    try {
      const res = await api.post('/payments/checkout', { kind: 'plan', plan_code: plan.code, coupon: coupon.trim() || undefined });
      toast(`${t('pricing.orderCreated')} — ${res.order.reference}`, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (missing) {
    return (
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className="card">
          <EmptyState icon="crown" title={t('plan.notFound')} action={<Link className="btn btn-outline" to="/pricing">{t('nav.pricing')}</Link>} />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="container" style={{ paddingTop: 30, paddingBottom: 50 }}>
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  const features = Array.isArray(plan.features) ? plan.features : [];

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 50, maxWidth: 820 }}>
      <Link to="/pricing" className="small row" style={{ gap: 6, color: 'var(--brand)', marginBottom: 14 }}>
        <Icon name="chevronLeft" size={15} /> {t('nav.pricing')}
      </Link>

      <div className="card card-pad stack" style={{ gap: 16 }}>
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.3rem,3vw,1.7rem)' }}>{pickName(plan.name, lang)}</h1>
            <p className="small muted">{pickName(plan.description, lang)}</p>
          </div>
          <div className="center" style={{ minWidth: 120 }}>
            <b style={{ fontSize: '1.5rem' }}>{formatPrice(plan.price, plan.currency, lang)}</b>
            <div className="tiny muted">/ {plan.duration_days} {t('plan.days')}</div>
          </div>
        </div>

        <Alert type="info" icon="info">{t('pricing.notice')}</Alert>

        <div className="kpi-grid">
          <div className="stat-card">
            <span className="label">{t('plan.duration')}</span>
            <span className="value">{formatNumber(plan.duration_days, lang)}</span>
            <span className="tiny muted">{t('plan.days')}</span>
          </div>
          <div className="stat-card">
            <span className="label">{t('plan.quota')}</span>
            <span className="value">{formatNumber(plan.listing_quota, lang)}</span>
          </div>
          <div className="stat-card">
            <span className="label">{t('plan.featuredQuota')}</span>
            <span className="value">{formatNumber(plan.featured_quota, lang)}</span>
          </div>
          <div className="stat-card">
            <span className="label">{t('admin.stores')}</span>
            <span className="value">{plan.is_store_plan ? '✓' : '—'}</span>
            <span className="tiny muted">{plan.is_store_plan ? t('plan.storePlan') : ''}</span>
          </div>
        </div>

        {features.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <b className="small">{t('plan.features')}</b>
            {features.map((f, i) => (
              <div key={i} className="row small" style={{ gap: 8 }}>
                <Icon name="checkCircle" size={15} style={{ color: 'var(--success)', flex: '0 0 auto' }} />
                <span>{typeof f === 'string' ? f : pickName(f, lang)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 200 }}
            placeholder={t('pricing.coupon')}
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            dir="ltr"
          />
          <Button loading={busy} onClick={checkout} icon="card">{t('plan.select')}</Button>
        </div>
      </div>
    </div>
  );
}
