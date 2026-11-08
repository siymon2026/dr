import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Button, EmptyState, Modal, StatusChip, Tabs } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api, qs } from '../../lib/api.js';
import { formatDate, timeAgo } from '../../lib/format.js';

export default function AdminReports() {
  const { t, lang, user, toast, errorMessage } = useApp();
  const [status, setStatus] = useState('open');
  const [data, setData] = useState(null);
  const [active, setActive] = useState(null);
  const [note, setNote] = useState('');
  const [action, setAction] = useState('none');
  const [busy, setBusy] = useState(false);

  const canHandle = user?.permissions?.includes('reports.handle');

  const load = useCallback(() => {
    setData(null);
    api
      .get(`/admin/reports${qs({ status })}`)
      .then((r) => setData(r.items))
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [status, toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (nextStatus) => {
    setBusy(true);
    try {
      await api.post(`/admin/reports/${active.id}`, { status: nextStatus, note, action });
      toast(t('account.saved'), 'success');
      setActive(null);
      setNote('');
      setAction('none');
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1 style={{ fontSize: '1.3rem' }}>{t('admin.reports')}</h1>
      <Tabs
        items={['open', 'reviewing', 'resolved', 'dismissed', 'all'].map((s) => ({ value: s, label: s }))}
        value={status}
        onChange={setStatus}
      />

      {!data && <div className="skeleton" style={{ height: 280 }} />}
      {data && data.length === 0 && <div className="card"><EmptyState icon="flag" title={t('search.noResults')} /></div>}

      <div className="stack" style={{ gap: 10 }}>
        {data?.map((r) => (
          <div key={r.id} className="card card-pad">
            <div className="row-between" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 260px' }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <span className="chip chip-danger tiny"><Icon name="flag" size={11} /> {t(`report.reason.${r.reason}`)}</span>
                  <span className="chip tiny">{r.target_type}</span>
                  <StatusChip status={r.status} />
                </div>
                <b className="small" style={{ display: 'block', marginTop: 6 }}>
                  {r.target?.title || r.target?.name || `#${r.target_id}`}
                </b>
                {r.details && <p className="small muted">{r.details}</p>}
                <div className="tiny muted mt-1">
                  {r.reporter_name || 'anonymous'} · {timeAgo(r.created_at, t)}
                  {r.handled_by && ` · handled by ${r.handler_name}`}
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {r.target_type === 'listing' && r.target?.public_id && (
                  <Link to={`/listing/${r.target.public_id}`} className="btn btn-sm btn-ghost" target="_blank"><Icon name="eye" size={14} /></Link>
                )}
                {canHandle && r.status !== 'resolved' && r.status !== 'dismissed' && (
                  <Button size="sm" variant="outline" onClick={() => setActive(r)}>{t('common.edit')}</Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? `${t('admin.reports')} #${active.id}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setActive(null)} type="button">{t('common.cancel')}</Button>
            <Button variant="outline" loading={busy} onClick={() => resolve('dismissed')} type="button">{t('notif.report_dismissed')}</Button>
            <Button loading={busy} onClick={() => resolve('resolved')} type="button" icon="check">{t('notif.report_resolved')}</Button>
          </>
        }
      >
        {active && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="card card-pad" style={{ padding: 12 }}>
              <b className="small">{active.target?.title || active.target?.name || `#${active.target_id}`}</b>
              <p className="tiny muted">{t(`report.reason.${active.reason}`)} — {active.details || '—'}</p>
            </div>
            <div className="field">
              <label htmlFor="note">{t('report.details')}</label>
              <textarea id="note" className="textarea" style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </div>
            <div className="field">
              <label htmlFor="action">Moderator action</label>
              <select id="action" className="select" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="none">none</option>
                {active.target_type === 'listing' && <option value="remove_listing">remove listing</option>}
                {active.target_type === 'user' && <option value="suspend_user">suspend user</option>}
                {active.target_type === 'store' && <option value="suspend_store">suspend store</option>}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
