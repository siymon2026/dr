import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BarChart, StatCard } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api } from '../../lib/api.js';
import { formatNumber, formatPrice } from '../../lib/format.js';

export default function Overview() {
  const { t, lang, user, toast, errorMessage } = useApp();
  const [stats, setStats] = useState(null);
  const [metric, setMetric] = useState('listings');

  useEffect(() => {
    api
      .get('/admin/stats')
      .then(setStats)
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [toast, errorMessage]);

  if (!stats) {
    return (
      <div className="stack">
        <div className="kpi-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton" style={{ height: 88 }} />)}
        </div>
        <div className="skeleton" style={{ height: 210 }} />
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.35rem' }}>{t('admin.overview')}</h1>
          <p className="small muted">{t('brand.name')} — {t('admin.title')}</p>
        </div>
        <span className="chip chip-success">
          <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--success)' }} />
          {stats.users.online} online
        </span>
      </div>

      {stats.moderation.pending_listings > 0 && (
        <Link to="/admin/listings?status=pending" className="alert alert-warning" style={{ textDecoration: 'none' }}>
          <Icon name="clock" size={17} />
          <span style={{ flex: 1 }}>{t('admin.pendingReview')}: <b>{stats.moderation.pending_listings}</b> {t('admin.listings')}</span>
          <Icon name="chevronLeft" size={16} className="rtl-flip" />
        </Link>
      )}
      {stats.moderation.open_reports > 0 && (
        <Link to="/admin/reports" className="alert alert-error" style={{ textDecoration: 'none' }}>
          <Icon name="flag" size={17} />
          <span style={{ flex: 1 }}>{t('admin.reports')}: <b>{stats.moderation.open_reports}</b></span>
          <Icon name="chevronLeft" size={16} className="rtl-flip" />
        </Link>
      )}

      <div className="kpi-grid">
        <StatCard label={t('admin.listings')} value={formatNumber(stats.listings.total, lang)} icon="list" hint={`${stats.listings.active} active · ${stats.listings.pending} pending`} />
        <StatCard label={t('admin.users')} value={formatNumber(stats.users.total, lang)} icon="users" hint={`${stats.users.sellers} sellers · +${stats.users.new_today} today`} />
        <StatCard label={t('admin.stores')} value={formatNumber(stats.stores.total, lang)} icon="store" hint={`${stats.stores.pending} pending`} />
        <StatCard label={t('admin.revenue')} value={formatPrice(stats.finance.revenue, 'MAD', lang)} icon="money" hint={`${stats.finance.paid_orders} paid orders`} />
        <StatCard label={t('listing.views')} value={formatNumber(stats.engagement.views, lang)} icon="eye" hint={`${formatNumber(stats.engagement.favorites, lang)} favorites`} />
        <StatCard label={t('nav.messages')} value={formatNumber(stats.engagement.messages, lang)} icon="message" hint={`${stats.engagement.conversations} conversations`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16 }}>
        <div className="card card-pad">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <b style={{ fontSize: '0.94rem' }}>14 {lang === 'ar' ? 'يوم' : lang === 'fr' ? 'jours' : 'days'}</b>
            <div className="row" style={{ gap: 4 }}>
              {['listings', 'users', 'views', 'revenue'].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chip ${metric === m ? 'chip-brand' : ''}`}
                  style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                  onClick={() => setMetric(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <BarChart data={stats.series} valueKey={metric} />
        </div>

        <div className="card card-pad stack" style={{ gap: 10 }}>
          <b style={{ fontSize: '0.94rem' }}>{t('admin.finance')}</b>
          {[
            { label: t('admin.revenue'), value: formatPrice(stats.finance.revenue, 'MAD', lang) },
            { label: t('admin.revenue') + ' (24h)', value: formatPrice(stats.finance.revenue_today, 'MAD', lang) },
            { label: t('admin.subscriptions'), value: stats.finance.active_subscriptions },
            { label: 'pending orders', value: stats.finance.pending_orders },
          ].map((r) => (
            <div key={r.label} className="row-between tiny" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="muted">{r.label}</span>
              <b>{r.value}</b>
            </div>
          ))}
          <Link to="/admin/finance" className="btn btn-outline btn-sm">{t('common.more')}</Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))' }}>
        <div className="card card-pad">
          <b style={{ fontSize: '0.9rem' }}>{t('admin.listings')}</b>
          <div className="stack mt-2" style={{ gap: 6 }}>
            {[
              ['active', stats.listings.active],
              ['pending', stats.listings.pending],
              ['rejected', stats.listings.rejected],
              ['expired', stats.listings.expired],
              ['sold', stats.listings.sold],
              ['featured', stats.listings.featured],
            ].map(([k, v]) => (
              <div key={k} className="row-between tiny">
                <span className="muted">{k}</span>
                <b>{formatNumber(v, lang)}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <b style={{ fontSize: '0.9rem' }}>{t('admin.users')}</b>
          <div className="stack mt-2" style={{ gap: 6 }}>
            {[
              ['active', stats.users.active],
              ['suspended', stats.users.suspended],
              ['banned', stats.users.banned],
              ['sellers', stats.users.sellers],
              ['new today', stats.users.new_today],
            ].map(([k, v]) => (
              <div key={k} className="row-between tiny">
                <span className="muted">{k}</span>
                <b>{formatNumber(v, lang)}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <b style={{ fontSize: '0.9rem' }}>{t('admin.stores')}</b>
          <div className="stack mt-2" style={{ gap: 6 }}>
            {[
              ['active', stats.stores.active],
              ['pending', stats.stores.pending],
              ['verified', stats.stores.verified],
            ].map(([k, v]) => (
              <div key={k} className="row-between tiny">
                <span className="muted">{k}</span>
                <b>{formatNumber(v, lang)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="tiny muted">
        {user.name} · {user.role} · {user.permissions.length} permissions
      </p>
    </div>
  );
}
