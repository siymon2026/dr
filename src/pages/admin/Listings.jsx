import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Button, ConfirmDialog, EmptyState, Modal, StatusChip, Tabs } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api, qs } from '../../lib/api.js';
import { formatDate, formatPrice } from '../../lib/format.js';

const STATUS_TABS = ['pending', 'active', 'rejected', 'sold', 'expired', 'all'];

export default function AdminListings() {
  const { t, lang, toast, errorMessage, user } = useApp();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'pending';
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [preview, setPreview] = useState(null);

  const canModerate = user?.permissions?.includes('listings.moderate');
  const canDelete = user?.permissions?.includes('listings.delete');

  const load = useCallback(() => {
    setData(null);
    api
      .get(`/admin/listings${qs({ status, q, limit: 50 })}`)
      .then(setData)
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [status, q, toast, errorMessage]);

  useEffect(() => {
    load();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const moderate = async (listing, decision, why) => {
    setBusy(true);
    try {
      await api.post(`/admin/listings/${listing.id}/moderate`, { decision, reason: why });
      toast(t(decision === 'approve' ? 'notif.listing_approved' : 'notif.listing_rejected'), 'success');
      setReject(null);
      setReason('');
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const bulk = async (decision) => {
    if (!selected.length) return;
    setBusy(true);
    try {
      await api.post('/admin/listings/bulk-moderate', { ids: selected, decision, reason: decision === 'reject' ? 'bulk' : undefined });
      setSelected([]);
      load();
      toast(t('account.saved'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/listings/${confirmDelete.id}`, { reason: 'admin' });
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.3rem' }}>{t('admin.listings')}</h1>
        <div className="row" style={{ gap: 8 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            className="row"
            style={{ gap: 6 }}
          >
            <input className="input" style={{ width: 200 }} placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit" size="sm" variant="outline" icon="search" />
          </form>
        </div>
      </div>

      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <Tabs
          items={STATUS_TABS.map((s) => ({ value: s, label: s === 'all' ? t('common.all') : s }))}
          value={status}
          onChange={(v) => setParams(v === 'pending' ? {} : { status: v })}
        />
        {selected.length > 0 && canModerate && (
          <div className="row" style={{ gap: 6 }}>
            <span className="chip chip-brand">{selected.length}</span>
            <Button size="sm" onClick={() => bulk('approve')} loading={busy} icon="check">{t('admin.approve')}</Button>
            <Button size="sm" variant="danger-outline" onClick={() => bulk('reject')} loading={busy} icon="close">{t('admin.reject')}</Button>
          </div>
        )}
      </div>

      {!data && <div className="skeleton" style={{ height: 320 }} />}

      {data && data.items.length === 0 && (
        <div className="card"><EmptyState icon="list" title={t('search.noResults')} /></div>
      )}

      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 34 }} />
                <th>{t('post.field.title')}</th>
                <th>{t('listing.owner')}</th>
                <th>{t('post.field.price')}</th>
                <th>{t('filters.category')}</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id}>
                  <td>
                    <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} aria-label="select" />
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      {l.image ? (
                        <img src={l.image} alt="" style={{ width: 40, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                      ) : (
                        <span style={{ width: 40, height: 32, borderRadius: 6, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
                          <Icon name="image" size={14} />
                        </span>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <button type="button" className="link truncate" style={{ background: 'none', border: 'none', cursor: 'pointer', maxWidth: 240, textAlign: 'start' }} onClick={() => setPreview(l)}>
                          {l.title}
                        </button>
                        <div className="tiny muted">#{l.id} · {formatDate(l.created_at, lang)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Link to={`/users/${l.user_id}`} className="link small">{l.owner_name}</Link>
                    <div className="tiny muted truncate" style={{ maxWidth: 150 }}>{l.owner_email}</div>
                  </td>
                  <td className="nowrap">{l.price_cents > 0 ? formatPrice(l.price_cents / 100, l.currency, lang) : '—'}</td>
                  <td className="small">{l.category_ar}</td>
                  <td>
                    <StatusChip status={l.status} />
                    {l.open_reports > 0 && <span className="chip chip-danger tiny" style={{ marginInlineStart: 4 }}><Icon name="flag" size={10} /> {l.open_reports}</span>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <Link to={`/listing/${l.public_id}`} className="btn btn-sm btn-ghost" title="view"><Icon name="eye" size={14} /></Link>
                      {canModerate && l.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => moderate(l, 'approve')} icon="check">{t('admin.approve')}</Button>
                          <Button size="sm" variant="danger-outline" onClick={() => setReject(l)} icon="close">{t('admin.reject')}</Button>
                        </>
                      )}
                      {canModerate && l.status !== 'pending' && (
                        <Button size="sm" variant="ghost" onClick={() => setReject(l)}>{t('admin.suspend')}</Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(l)} icon="trash" aria-label="delete" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!reject}
        onClose={() => setReject(null)}
        title={`${t('admin.reject')} — ${reject?.title?.slice(0, 40) || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReject(null)} type="button">{t('common.cancel')}</Button>
            <Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => moderate(reject, 'reject', reason)} type="button">
              {t('admin.reject')}
            </Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="reject-reason">{t('admin.reason')} <span style={{ color: 'var(--danger)' }}>*</span></label>
          <textarea id="reject-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('admin.reasonRequired')} maxLength={300} />
        </div>
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title} size={640}>
        {preview && (
          <div className="stack">
            {preview.image && <img src={preview.image} alt="" style={{ borderRadius: 10, maxHeight: 260, objectFit: 'cover', width: '100%' }} />}
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <StatusChip status={preview.status} />
              <span className="chip">{preview.category_ar}</span>
              <span className="chip">{preview.city_ar}</span>
              <span className="chip">{formatPrice(preview.price_cents / 100, preview.currency, lang)}</span>
            </div>
            <Link to={`/listing/${preview.public_id}`} className="btn btn-outline btn-sm" target="_blank">
              <Icon name="external" size={14} /> {t('common.viewAll')}
            </Link>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title={t('common.delete')}
        message={confirmDelete?.title}
        confirmLabel={t('common.delete')}
        danger
        loading={busy}
        onClose={() => setConfirmDelete(null)}
        onConfirm={remove}
      />
    </div>
  );
}
