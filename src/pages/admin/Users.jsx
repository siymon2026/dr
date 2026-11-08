import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Avatar, Button, EmptyState, Modal, StatusChip } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api, qs } from '../../lib/api.js';
import { formatDate, timeAgo } from '../../lib/format.js';

const ROLES = ['user', 'support', 'finance', 'moderator', 'admin', 'superadmin'];

export default function AdminUsers() {
  const { t, lang, user, toast, errorMessage } = useApp();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');

  const can = (perm) => user?.permissions?.includes(perm);

  const load = useCallback(() => {
    setData(null);
    api
      .get(`/admin/users${qs({ q, status, role, limit: 50 })}`)
      .then(setData)
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [q, status, role, toast, errorMessage]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (id) => {
    try {
      const res = await api.get(`/admin/users/${id}`);
      setDetail(res);
      setReason('');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const patch = async (payload) => {
    setBusy(true);
    try {
      const res = await api.patch(`/admin/users/${detail.user.id}`, payload);
      setDetail({ ...detail, user: res.user });
      load();
      toast(t('account.saved'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.3rem' }}>{t('admin.users')}</h1>
        <form
          className="row"
          style={{ gap: 6, flexWrap: 'wrap' }}
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input className="input" style={{ width: 190 }} placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ width: 130 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">status</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="banned">banned</option>
          </select>
          <select className="select" style={{ width: 130 }} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">role</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <Button type="submit" size="sm" variant="outline" icon="search" />
        </form>
      </div>

      {!data && <div className="skeleton" style={{ height: 320 }} />}
      {data && data.items.length === 0 && <div className="card"><EmptyState icon="users" title={t('search.noResults')} /></div>}

      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t('auth.name')}</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Status</th>
                <th>{t('myListings.active')}</th>
                <th>{t('review.rating')}</th>
                <th>{t('listing.memberSince')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar src={null} name={u.name} size="sm" />
                      <div>
                        <div className="row" style={{ gap: 4 }}>
                          <b className="small">{u.name}</b>
                          {u.verified_seller && <Icon name="verified" size={13} style={{ color: 'var(--brand-600)' }} />}
                          {u.is_store && <Icon name="store" size={12} style={{ color: 'var(--ink-400)' }} />}
                        </div>
                        <span className="tiny muted">#{u.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="tiny" dir="ltr">{u.email || u.phone || '—'}</td>
                  <td><span className={`chip tiny ${u.role !== 'user' ? 'chip-brand' : ''}`}>{u.role}</span></td>
                  <td><StatusChip status={u.status} /></td>
                  <td>{u.active_listings}</td>
                  <td>{u.rating_count ? `${Number(u.rating_avg).toFixed(1)} ★` : '—'}</td>
                  <td className="tiny nowrap">{formatDate(u.created_at, lang)}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => openDetail(u.id)} icon="eye" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.user?.name} size={720}>
        {detail && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 12 }}>
              <Avatar src={detail.user.avatar} name={detail.user.name} size="lg" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <StatusChip status={detail.user.status} />
                  <span className="chip tiny">{detail.user.role}</span>
                  {detail.user.email_verified && <span className="chip chip-success tiny">email ✓</span>}
                  {detail.user.phone_verified && <span className="chip chip-success tiny">phone ✓</span>}
                </div>
                <div className="tiny muted mt-1" dir="ltr">{detail.user.email || detail.user.phone}</div>
                <div className="tiny muted">{t('listing.memberSince')} {formatDate(detail.user.created_at, lang)}</div>
              </div>
            </div>

            {can('users.status') && (
              <div className="card card-pad" style={{ padding: 12, display: 'grid', gap: 8 }}>
                <b className="small">{t('admin.suspend')} / {t('admin.activate')}</b>
                <input className="input" placeholder={t('admin.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <Button size="sm" loading={busy} onClick={() => patch({ status: 'active' })} type="button" icon="check">{t('admin.activate')}</Button>
                  <Button size="sm" variant="outline" loading={busy} onClick={() => patch({ status: 'suspended', status_reason: reason })} type="button">{t('admin.suspend')}</Button>
                  <Button size="sm" variant="danger-outline" loading={busy} onClick={() => patch({ status: 'banned', status_reason: reason })} type="button" icon="ban">{t('admin.suspend')} (ban)</Button>
                </div>
              </div>
            )}

            {can('users.verify') && (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <Button size="sm" variant={detail.user.verified_seller ? 'outline' : 'soft'} loading={busy} onClick={() => patch({ verified_seller: !detail.user.verified_seller })} type="button" icon="verified">
                  {detail.user.verified_seller ? t('admin.unverify') : t('admin.verify')}
                </Button>
              </div>
            )}

            {can('users.roles') && detail.user.role !== 'superadmin' && (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <select
                  className="select"
                  style={{ width: 200 }}
                  value={detail.user.role}
                  onChange={(e) => patch({ role: e.target.value })}
                >
                  {ROLES.filter((r) => r !== 'superadmin').map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="tiny muted">role changes are audit-logged</span>
              </div>
            )}

            <div className="divider" />
            <b className="small">{t('account.activity')}</b>
            <div className="stack" style={{ gap: 4, maxHeight: 190, overflowY: 'auto' }}>
              {detail.activity.length === 0 && <span className="tiny muted">—</span>}
              {detail.activity.map((a, i) => (
                <div key={i} className="row-between tiny" style={{ padding: '5px 8px', background: 'var(--surface-2)', borderRadius: 6 }}>
                  <span>{a.action}</span>
                  <span className="muted">{timeAgo(a.created_at, t)}</span>
                </div>
              ))}
            </div>

            {detail.reports.length > 0 && (
              <>
                <b className="small">{t('admin.reports')}</b>
                <div className="stack" style={{ gap: 4 }}>
                  {detail.reports.map((r) => (
                    <div key={r.id} className="row-between tiny">
                      <span>{r.reason} — {r.details || '—'}</span>
                      <span className="chip tiny">{r.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="row" style={{ gap: 8 }}>
              <Link to={`/users/${detail.user.id}`} className="btn btn-outline btn-sm" target="_blank">
                <Icon name="external" size={14} /> public profile
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
