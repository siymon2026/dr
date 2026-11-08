import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Alert, Button, ConfirmDialog, EmptyState, StatusChip, Tabs } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { formatPrice, pickName, timeAgo } from '../lib/format.js';

const TABS = ['all', 'active', 'pending', 'rejected', 'paused', 'sold', 'expired'];

export default function MyListings() {
  const { t, lang, user, toast, errorMessage } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) navigate('/login?next=/my-listings', { replace: true });
  }, [user, navigate]);

  const load = () => {
    setLoading(true);
    api
      .get('/listings/mine')
      .then(setData)
      .catch((err) => toast(errorMessage(err), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const action = async (listing, act) => {
    setBusy(true);
    try {
      if (act === 'delete') {
        await api.del(`/listings/${listing.id}`);
        toast(t('common.delete'), 'success');
        setConfirmDelete(null);
      } else {
        const res = await api.post(`/listings/${listing.id}/status`, { action: act });
        toast(`${t('myListings.stats')}: ${res.status}`, 'success');
      }
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const items = useMemo(() => {
    if (!data) return [];
    return tab === 'all' ? data.items : data.items.filter((l) => l.status === tab);
  }, [data, tab]);

  const tabs = TABS.map((value) => ({
    value,
    label: t(`myListings.${value}`),
    count: value === 'all' ? data?.items.length : data?.counts?.[value] || 0,
  }));

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 44 }}>
      <div className="row-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.25rem,3vw,1.6rem)' }}>{t('myListings.title')}</h1>
          {data?.quota && (
            <p className="small muted">
              {t('post.quota', { used: data.quota.used, quota: data.quota.quota })}
              {data.quota.plan && ` · ${data.quota.plan.name_ar}`}
            </p>
          )}
        </div>
        <Link to="/post" className="btn"><Icon name="plus" size={16} /> {t('myListings.add')}</Link>
      </div>

      {data?.quota && data.quota.remaining <= 0 && (
        <Alert type="warning" icon="alert">
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span>{t('post.quotaFull')}</span>
            <Link to="/pricing" className="btn btn-sm btn-accent">{t('nav.pricing')}</Link>
          </div>
        </Alert>
      )}

      <div style={{ margin: '14px 0' }}>
        <Tabs items={tabs} value={tab} onChange={setTab} />
      </div>

      {loading && (
        <div className="stack">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 108, borderRadius: 'var(--radius)' }} />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="card">
          <EmptyState
            icon="list"
            title={t('myListings.empty')}
            hint={t('post.subtitle')}
            action={<Link to="/post" className="btn mt-2"><Icon name="plus" size={16} /> {t('nav.post')}</Link>}
          />
        </div>
      )}

      <div className="stack" style={{ gap: 10 }}>
        {items.map((l) => (
          <div key={l.id} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Link to={`/listing/${l.public_id}`} style={{ flex: '0 0 96px' }}>
                {l.image ? (
                  <img src={l.image} alt="" style={{ width: 96, height: 76, objectFit: 'cover', borderRadius: 10 }} />
                ) : (
                  <div style={{ width: 96, height: 76, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
                    <Icon name="image" size={22} style={{ color: 'var(--ink-300)' }} />
                  </div>
                )}
              </Link>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <Link to={`/listing/${l.public_id}`} className="strong" style={{ fontSize: '0.94rem', display: 'block' }}>
                  {l.title}
                </Link>
                <div className="row" style={{ gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <b style={{ color: 'var(--brand-700)', fontSize: '0.92rem' }}>
                    {l.price > 0 ? formatPrice(l.price, l.currency, lang) : t('store.contact')}
                  </b>
                  <StatusChip status={l.status} />
                  {l.featured && <span className="chip chip-accent"><Icon name="spark" size={11} /> {t('listing.featured')}</span>}
                </div>
                <div className="row tiny muted" style={{ gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                  <span className="row" style={{ gap: 3 }}><Icon name="eye" size={12} /> {l.views}</span>
                  <span className="row" style={{ gap: 3 }}><Icon name="heart" size={12} /> {l.favorites}</span>
                  <span className="row" style={{ gap: 3 }}><Icon name="message" size={12} /> {l.contacts}</span>
                  <span className="row" style={{ gap: 3 }}><Icon name="clock" size={12} /> {timeAgo(l.created_at, t)}</span>
                  <span>{pickName(l.city?.name, lang)}</span>
                </div>
                {l.status === 'rejected' && l.rejection_reason && (
                  <div className="alert alert-error mt-2" style={{ padding: '7px 10px', fontSize: '0.78rem' }}>
                    <Icon name="alert" size={13} />
                    <span><b>{t('myListings.rejectReason')}:</b> {l.rejection_reason}</span>
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Link to={`/listings/${l.id}/edit`} className="btn btn-sm btn-outline">
                  <Icon name="edit" size={13} /> {t('myListings.edit')}
                </Link>
                {l.status === 'active' && (
                  <Button size="sm" variant="ghost" onClick={() => action(l, 'pause')} type="button" icon="clock">
                    {t('myListings.pause')}
                  </Button>
                )}
                {l.status === 'paused' && (
                  <Button size="sm" variant="ghost" onClick={() => action(l, 'resume')} type="button" icon="refresh">
                    {t('myListings.resume')}
                  </Button>
                )}
                {['active', 'paused', 'pending'].includes(l.status) && (
                  <Button size="sm" variant="ghost" onClick={() => action(l, 'sold')} type="button" icon="check">
                    {t('myListings.markSold')}
                  </Button>
                )}
                {['paused', 'expired', 'rejected', 'sold'].includes(l.status) && (
                  <Button size="sm" variant="ghost" onClick={() => action(l, 'republish')} type="button" icon="refresh">
                    {t('myListings.republish')}
                  </Button>
                )}
                <Link to={`/listing/${l.public_id}`} className="btn btn-sm btn-ghost">
                  <Icon name="eye" size={13} />
                </Link>
                <Button size="sm" variant="danger-outline" onClick={() => setConfirmDelete(l)} type="button" icon="trash">
                  {t('myListings.delete')}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title={t('myListings.delete')}
        message={t('myListings.confirmDelete')}
        confirmLabel={t('common.delete')}
        danger
        loading={busy}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => action(confirmDelete, 'delete')}
      />
    </div>
  );
}
