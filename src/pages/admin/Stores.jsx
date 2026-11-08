import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Avatar, Button, EmptyState, Modal, Stars, StatusChip, Tabs } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api, qs } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';

export default function AdminStores() {
  const { t, lang, user, toast, errorMessage } = useApp();
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const can = (p) => user?.permissions?.includes(p);

  const load = useCallback(() => {
    setData(null);
    api
      .get(`/admin/stores${qs({ status, limit: 50 })}`)
      .then(setData)
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [status, toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const setStoreStatus = async (store, next) => {
    setBusy(true);
    try {
      await api.post(`/admin/stores/${store.id}/status`, { status: next, reason });
      toast(t('account.saved'), 'success');
      setDetail(null);
      setReason('');
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (store, verified) => {
    setBusy(true);
    try {
      await api.post(`/admin/stores/${store.id}/verify`, { verified });
      toast(t('account.saved'), 'success');
      setDetail(null);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1 style={{ fontSize: '1.3rem' }}>{t('admin.stores')}</h1>
      <Tabs
        items={['pending', 'active', 'suspended', 'rejected', 'all'].map((s) => ({ value: s, label: s }))}
        value={status}
        onChange={setStatus}
      />

      {!data && <div className="skeleton" style={{ height: 300 }} />}
      {data && data.items.length === 0 && <div className="card"><EmptyState icon="store" title={t('search.noResults')} /></div>}

      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t('store.name')}</th>
                <th>Owner</th>
                <th>{t('filters.city')}</th>
                <th>Products</th>
                <th>{t('store.reviews')}</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar src={s.logo} name={s.name} size="sm" />
                      <div>
                        <div className="row" style={{ gap: 4 }}>
                          <b className="small">{s.name}</b>
                          {s.verified && <Icon name="verified" size={13} style={{ color: 'var(--brand-600)' }} />}
                          {s.featured && <Icon name="spark" size={12} style={{ color: 'var(--accent-500)' }} />}
                        </div>
                        <span className="tiny muted">{formatDate(s.created_at, lang)}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Link to={`/users/${s.user_id}`} className="link small">{s.owner_name}</Link>
                    <div className="tiny muted truncate" style={{ maxWidth: 140 }}>{s.owner_email}</div>
                  </td>
                  <td className="small">{s.city_ar || '—'}</td>
                  <td>{s.listings_count}</td>
                  <td>{s.rating_count ? `${Number(s.rating_avg).toFixed(1)} ★` : '—'}</td>
                  <td><StatusChip status={s.status} /></td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => { setDetail(s); setReason(''); }} icon="eye" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name} size={640}>
        {detail && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 10 }}>
              <Avatar src={detail.logo} name={detail.name} size="lg" />
              <div>
                <Stars value={detail.rating_avg} count={detail.rating_count} />
                <div className="tiny muted">{detail.followers_count} {t('store.followers')} · {detail.listings_count} {t('store.products')}</div>
              </div>
            </div>
            <p className="small muted">{detail.description}</p>
            {can('stores.moderate') && (
              <div className="card card-pad" style={{ padding: 12, display: 'grid', gap: 8 }}>
                <input className="input" placeholder={t('admin.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <Button size="sm" loading={busy} onClick={() => setStoreStatus(detail, 'active')} icon="check" type="button">{t('admin.approve')}</Button>
                  <Button size="sm" variant="outline" loading={busy} onClick={() => setStoreStatus(detail, 'rejected')} type="button">{t('admin.reject')}</Button>
                  <Button size="sm" variant="danger-outline" loading={busy} onClick={() => setStoreStatus(detail, 'suspended')} type="button">{t('admin.suspend')}</Button>
                </div>
              </div>
            )}
            {can('stores.verify') && (
              <Button size="sm" variant={detail.verified ? 'outline' : 'soft'} loading={busy} onClick={() => verify(detail, !detail.verified)} icon="verified" type="button">
                {detail.verified ? t('admin.unverify') : t('admin.verify')}
              </Button>
            )}
            <Link to={`/stores/${detail.slug}`} className="btn btn-outline btn-sm" target="_blank" style={{ width: 'fit-content' }}>
              <Icon name="external" size={14} /> {t('listing.viewStore')}
            </Link>
          </div>
        )}
      </Modal>
    </div>
  );
}
