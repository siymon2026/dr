import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Alert, Button, EmptyState, Modal } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';

const STATUSES = ['new', 'open', 'answered', 'closed', 'spam'];

/**
 * Contact-form inbox: read, triage and reply to messages sent from /contact.
 * A reply is mailed through the configured mail provider (or logged when the
 * provider is not configured) and appended to the thread.
 */
export default function AdminInbox() {
  const { t, lang, toast, errorMessage } = useApp();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (q.trim()) params.set('q', q.trim());
    api
      .get(`/admin/inbox?${params.toString()}`)
      .then(setData)
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [filter, q, toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (item, status, withNote) => {
    setBusy(true);
    try {
      await api.put(`/admin/inbox/${item.id}`, { status, note: withNote ? note.trim() : undefined });
      toast(withNote && note.trim() ? t('admin.replied') : t('account.saved'), 'success');
      setOpen(null);
      setNote('');
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item) => {
    setBusy(true);
    try {
      await api.delete(`/admin/inbox/${item.id}`);
      setOpen(null);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const counts = data?.counts || {};

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.3rem' }}>
          {t('admin.inbox')}
          {data?.unread > 0 && <span className="chip chip-brand tiny" style={{ marginInlineStart: 8 }}>{data.unread} {t('admin.inboxNew')}</span>}
        </h1>
        <form
          className="row"
          style={{ gap: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input className="input" style={{ width: 200 }} placeholder={t('search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          <Button size="sm" variant="outline" type="submit" icon="search" />
        </form>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className={`chip ${filter === 'all' ? 'chip-brand' : ''}`} onClick={() => setFilter('all')}>
          {t('common.all')} {(data?.items?.length ?? 0) > 0 ? '' : ''}
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`chip ${filter === s ? 'chip-brand' : ''}`} onClick={() => setFilter(s)}>
            {t(`admin.inboxStatus.${s}`)} {counts[s] || 0}
          </button>
        ))}
      </div>

      {!data && <div className="skeleton" style={{ height: 300 }} />}
      {data && data.items.length === 0 && (
        <div className="card">
          <EmptyState icon="mail" title={t('admin.inboxEmpty')} />
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        {data?.items.map((m) => (
          <button
            key={m.id}
            type="button"
            className="card card-pad"
            style={{ textAlign: 'start', cursor: 'pointer', borderInlineStart: m.status === 'new' ? '3px solid var(--brand)' : undefined }}
            onClick={() => {
              setOpen(m);
              setNote('');
            }}
          >
            <div className="row-between" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="row" style={{ gap: 8, minWidth: 0 }}>
                <Icon name="mail" size={15} />
                <b className="small">{m.subject || '—'}</b>
                <span className="tiny muted">{m.name} · {m.email}</span>
              </span>
              <span className="row" style={{ gap: 6 }}>
                <span className={`chip tiny ${m.status === 'new' ? 'chip-brand' : m.status === 'spam' ? 'chip-danger' : ''}`}>{t(`admin.inboxStatus.${m.status}`)}</span>
                <span className="tiny muted nowrap">{formatDate(m.created_at, lang, { withTime: true })}</span>
              </span>
            </div>
            <p className="small muted" style={{ marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {m.message}
            </p>
          </button>
        ))}
      </div>

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.subject || t('admin.inbox')}
        footer={
          open && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button size="sm" variant="ghost" onClick={() => update(open, 'spam')} loading={busy}>{t('admin.spam')}</Button>
              <Button size="sm" variant="ghost" onClick={() => update(open, 'closed')} loading={busy}>{t('admin.markClosed')}</Button>
              <Button size="sm" variant="outline" onClick={() => remove(open)} loading={busy} icon="trash" />
              <Button size="sm" loading={busy} disabled={!note.trim()} onClick={() => update(open, 'answered', true)} icon="send">
                {t('admin.reply')}
              </Button>
            </div>
          )
        }
      >
        {open && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="tiny muted" dir="ltr">
              {open.name} · {open.email} · {formatDate(open.created_at, lang, { withTime: true })}
            </div>
            <div className="card card-pad small" style={{ whiteSpace: 'pre-wrap', background: 'var(--surface-2)' }}>{open.message}</div>
            <textarea
              className="input"
              rows={4}
              placeholder={t('admin.replyPlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {open.status === 'new' && (
              <div className="row">
                <Button size="sm" variant="ghost" onClick={() => update(open, 'open')} loading={busy}>{t('admin.markRead')}</Button>
              </div>
            )}
            <Alert type="info" icon="info">{t('admin.settingsRestartNote')}</Alert>
          </div>
        )}
      </Modal>
    </div>
  );
}
