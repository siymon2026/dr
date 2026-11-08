import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Button, EmptyState } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';

const ICONS = {
  message: ['message', 'var(--info)'],
  listing_approved: ['checkCircle', 'var(--success)'],
  listing_rejected: ['close', 'var(--danger)'],
  listing_pending: ['clock', 'var(--warning)'],
  listing_expiring: ['clock', 'var(--warning)'],
  listing_favorited: ['heart', 'var(--accent-500)'],
  listing_interest: ['eye', 'var(--info)'],
  subscription_expiring: ['crown', 'var(--warning)'],
  report_update: ['flag', 'var(--info)'],
  review_received: ['star', '#f5a623'],
  order_paid: ['checkCircle', 'var(--success)'],
  account_update: ['user', 'var(--brand-600)'],
  store_update: ['store', 'var(--brand-600)'],
  system: ['info', 'var(--text-muted)'],
};

export default function Notifications() {
  const { t, user, toast, errorMessage, refreshCounts } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!user) navigate('/login?next=/notifications', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get('/notifications').then((r) => setItems(r.items)).catch((err) => toast(errorMessage(err), 'error'));
  }, [user, toast, errorMessage]);

  const markAll = async () => {
    await api.post('/notifications/read-all', {});
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || Date.now() })));
    refreshCounts();
  };

  const open = async (n) => {
    if (!n.read_at) {
      api.post(`/notifications/${n.id}/read`, {}).then(refreshCounts).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: Date.now() } : x)));
    }
    if (n.link) navigate(n.link);
  };

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 24, paddingBottom: 44 }}>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 'clamp(1.2rem,3vw,1.5rem)' }}>{t('notifications.title')}</h1>
        {items?.some((n) => !n.read_at) && (
          <Button size="sm" variant="outline" onClick={markAll} icon="check">{t('notifications.markAll')}</Button>
        )}
      </div>

      {!items && (
        <div className="stack">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 66 }} />)}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="card"><EmptyState icon="bell" title={t('notifications.empty')} /></div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        {items?.map((n) => {
          const [icon, color] = ICONS[n.type] || ICONS.system;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => open(n)}
              className="card card-pad row"
              style={{
                gap: 12,
                textAlign: 'start',
                cursor: 'pointer',
                background: n.read_at ? 'var(--surface)' : 'var(--brand-50)',
                borderColor: n.read_at ? 'var(--border)' : 'var(--brand-200)',
                alignItems: 'flex-start',
              }}
            >
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', color, flex: '0 0 auto' }}>
                <Icon name={icon} size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-between" style={{ gap: 8 }}>
                  <b style={{ fontSize: '0.88rem' }}>{t(n.title_key) === n.title_key ? n.title_key : t(n.title_key)}</b>
                  <span className="tiny muted nowrap">{timeAgo(n.created_at, t)}</span>
                </div>
                {n.body && <p className="small muted truncate">{n.body}</p>}
              </div>
              {!n.read_at && <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--accent-500)', flex: '0 0 auto', marginTop: 6 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
