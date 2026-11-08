import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Alert, Button, EmptyState, Field } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api } from '../../lib/api.js';
import { formatDate, timeAgo } from '../../lib/format.js';

/* =========================== content (pages + faqs) =========================== */

export function AdminContent() {
  const { t, toast, errorMessage } = useApp();
  const [pages, setPages] = useState(null);
  const [faqs, setFaqs] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title_ar: '', title_fr: '', title_en: '', body_ar: '', body_fr: '', body_en: '', published: true });
  const [faqForm, setFaqForm] = useState({ q_ar: '', a_ar: '', q_fr: '', a_fr: '', q_en: '', a_en: '' });
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('pages');

  const load = useCallback(() => {
    api.get('/admin/pages').then((r) => setPages(r.items)).catch((e) => toast(errorMessage(e), 'error'));
    api.get('/admin/faqs').then((r) => setFaqs(r.items)).catch(() => setFaqs([]));
  }, [toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const openPage = (p) => {
    setEditing(p.slug);
    setForm({
      title_ar: p.title_ar, title_fr: p.title_fr, title_en: p.title_en,
      body_ar: p.body_ar || '', body_fr: p.body_fr || '', body_en: p.body_en || '',
      published: !!p.published,
    });
  };

  const savePage = async () => {
    setBusy(true);
    try {
      await api.put(`/admin/pages/${editing}`, form);
      toast(t('account.saved'), 'success');
      setEditing(null);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addFaq = async () => {
    setBusy(true);
    try {
      await api.post('/admin/faqs', faqForm);
      setFaqForm({ q_ar: '', a_ar: '', q_fr: '', a_fr: '', q_en: '', a_en: '' });
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
      <div className="row-between">
        <h1 style={{ fontSize: '1.3rem' }}>{t('admin.content')}</h1>
        <div className="row" style={{ gap: 4 }}>
          <button type="button" className={`chip ${tab === 'pages' ? 'chip-brand' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab('pages')}>pages</button>
          <button type="button" className={`chip ${tab === 'faqs' ? 'chip-brand' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab('faqs')}>FAQ</button>
        </div>
      </div>

      {tab === 'pages' && (
        <>
          {!pages && <div className="skeleton" style={{ height: 220 }} />}
          <div className="stack" style={{ gap: 8 }}>
            {pages?.map((p) => (
              <div key={p.slug} className="card card-pad row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b className="small">{p.title_ar}</b>
                  <div className="tiny muted">/{p.slug} · {p.published ? 'published' : 'draft'} · {formatDate(p.updated_at)}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openPage(p)} icon="edit">{t('common.edit')}</Button>
              </div>
            ))}
          </div>

          {editing && (
            <div className="card card-pad stack" style={{ gap: 12 }}>
              <div className="row-between">
                <b className="small">/{editing}</b>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)} icon="close" />
              </div>
              <div className="form-grid">
                <Field label="Title AR"><input className="input" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} /></Field>
                <Field label="Title FR"><input className="input" value={form.title_fr} onChange={(e) => setForm({ ...form, title_fr: e.target.value })} dir="ltr" /></Field>
                <Field label="Title EN"><input className="input" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} dir="ltr" /></Field>
              </div>
              <Field label="Body AR"><textarea className="textarea" value={form.body_ar} onChange={(e) => setForm({ ...form, body_ar: e.target.value })} /></Field>
              <Field label="Body FR"><textarea className="textarea" value={form.body_fr} onChange={(e) => setForm({ ...form, body_fr: e.target.value })} dir="ltr" /></Field>
              <Field label="Body EN"><textarea className="textarea" value={form.body_en} onChange={(e) => setForm({ ...form, body_en: e.target.value })} dir="ltr" /></Field>
              <label className="checkbox"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /><span>published</span></label>
              <Button size="sm" onClick={savePage} loading={busy} style={{ width: 'fit-content' }} icon="check">{t('common.save')}</Button>
            </div>
          )}
        </>
      )}

      {tab === 'faqs' && (
        <>
          <div className="card card-pad stack" style={{ gap: 8 }}>
            <div className="form-grid">
              <input className="input" placeholder="السؤال (عربي)" value={faqForm.q_ar} onChange={(e) => setFaqForm({ ...faqForm, q_ar: e.target.value })} />
              <input className="input" placeholder="Question FR" value={faqForm.q_fr} onChange={(e) => setFaqForm({ ...faqForm, q_fr: e.target.value })} dir="ltr" />
              <input className="input" placeholder="Question EN" value={faqForm.q_en} onChange={(e) => setFaqForm({ ...faqForm, q_en: e.target.value })} dir="ltr" />
            </div>
            <textarea className="textarea" style={{ minHeight: 70 }} placeholder="الجواب (عربي)" value={faqForm.a_ar} onChange={(e) => setFaqForm({ ...faqForm, a_ar: e.target.value })} />
            <Button size="sm" onClick={addFaq} loading={busy} style={{ width: 'fit-content' }} icon="plus">{t('common.save')}</Button>
          </div>

          {faqs?.length === 0 && <div className="card"><EmptyState icon="info" title="—" /></div>}
          <div className="stack" style={{ gap: 8 }}>
            {faqs?.map((f) => (
              <div key={f.id} className="card card-pad row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: '1 1 260px' }}>
                  <b className="small">{f.q_ar}</b>
                  <p className="tiny muted">{f.a_ar?.slice(0, 120)}</p>
                </div>
                <Button size="sm" variant="ghost" icon="trash" onClick={async () => { await api.del(`/admin/faqs/${f.id}`); load(); }} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* =========================== notifications =========================== */

export function AdminNotifications() {
  const { t, toast, errorMessage } = useApp();
  const [form, setForm] = useState({ body: '', link: '', role: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  const send = async () => {
    setBusy(true);
    try {
      const res = await api.post('/admin/notifications/broadcast', {
        title_key: 'notif.system',
        body: form.body,
        link: form.link || undefined,
        role: form.role || undefined,
      });
      setSent(res.sent);
      setForm({ body: '', link: '', role: '' });
      toast(t('account.saved'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1 style={{ fontSize: '1.3rem' }}>{t('admin.notifications')}</h1>
      {sent !== null && <Alert type="success" icon="checkCircle">sent to {sent} users</Alert>}
      <div className="card card-pad stack" style={{ gap: 12 }}>
        <Field label={t('report.details')} required>
          <textarea className="textarea" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={500} minLength={3} />
        </Field>
        <div className="form-grid">
          <Field label="link"><input className="input" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/pricing" dir="ltr" /></Field>
          <Field label="role (empty = all)">
            <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="">all active users</option>
              {['user', 'support', 'finance', 'moderator', 'admin'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>
        <Button onClick={send} loading={busy} disabled={form.body.trim().length < 3} style={{ width: 'fit-content' }} icon="send">
          {t('messages.send')}
        </Button>
      </div>
    </div>
  );
}

/* =========================== settings =========================== */

const SETTING_GROUPS = [
  { key: 'general', fields: ['site_name_ar', 'site_name_fr', 'site_name_en'] },
  { key: 'contact', fields: ['support_email', 'support_phone', 'contact_inbox'] },
  { key: 'listings', fields: ['listing_ttl_days', 'free_listing_quota', 'listing_max_images'] },
  { key: 'moderation', fields: ['moderation_auto_approve'] },
  { key: 'maintenance', fields: ['maintenance_mode', 'maintenance_message_ar', 'maintenance_message_fr', 'maintenance_message_en'] },
  { key: 'access', fields: ['signup_enabled'] },
];

export function AdminSettings() {
  const { t, lang, toast, errorMessage, refreshSettings } = useApp();
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const [group, setGroup] = useState('general');

  const hydrate = useCallback((d) => {
    setData(d);
    setDrafts(
      Object.fromEntries(
        d.known_keys.map((k) => [k, typeof d.effective[k] === 'boolean' ? d.effective[k] : String(d.effective[k] ?? '')]),
      ),
    );
  }, []);

  const load = useCallback(() => {
    api.get('/admin/settings').then(hydrate).catch((err) => toast(errorMessage(err), 'error'));
  }, [hydrate, toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (key) => {
    setSaving(key);
    try {
      const type = data.types?.[key] || typeof data.defaults[key];
      let value = drafts[key];
      if (type === 'number') value = Number(value);
      if (type !== 'boolean' && type !== 'number') value = String(value ?? '');
      await api.put(`/admin/settings/${encodeURIComponent(key)}`, { value });
      toast(t('account.saved'), 'success');
      await refreshSettings();
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(null);
    }
  };

  const reset = async (key) => {
    setSaving(key);
    try {
      await api.del(`/admin/settings/${encodeURIComponent(key)}`);
      toast(t('account.saved'), 'success');
      await refreshSettings();
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(null);
    }
  };

  const overrides = data?.override_keys || [];
  const active = SETTING_GROUPS.find((g) => g.key === group) || SETTING_GROUPS[0];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.3rem' }}>{t('admin.settings')}</h1>
        <span className="chip tiny"><Icon name="info" size={12} /> {t('admin.settingsRestartNote')}</span>
      </div>

      {data?.effective?.maintenance_mode && <Alert type="warning" icon="alert">{t('maintenance.banner')}</Alert>}

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {SETTING_GROUPS.map((g) => (
          <button key={g.key} type="button" className={`chip ${group === g.key ? 'chip-brand' : ''}`} onClick={() => setGroup(g.key)}>
            {t(`admin.settingsGroup.${g.key}`)}
          </button>
        ))}
      </div>

      {!data && <div className="skeleton" style={{ height: 300 }} />}

      {data && (
        <div className="stack" style={{ gap: 10 }}>
          {active.fields.map((key) => {
            const type = data.types?.[key] || typeof data.defaults[key];
            const overridden = overrides.includes(key);
            const dirty = String(drafts[key]) !== String(typeof data.effective[key] === 'boolean' ? data.effective[key] : data.effective[key] ?? '');
            return (
              <div key={key} className="card card-pad stack" style={{ gap: 8 }}>
                <div className="row-between" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <b className="small" dir="ltr">{key}</b>
                    <div className="tiny muted">{t(`admin.settingsHint.${key}`)}</div>
                  </div>
                  <span className={`chip tiny ${overridden ? 'chip-brand' : ''}`}>
                    {overridden ? t('admin.settingsOverridden') : t('admin.settingsDefault')}
                  </span>
                </div>

                {type === 'boolean' ? (
                  <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!drafts[key]}
                      onChange={(e) => setDrafts({ ...drafts, [key]: e.target.checked })}
                    />
                    <span className="small">{t(`admin.settingsHint.${key}`)}</span>
                  </label>
                ) : type === 'number' ? (
                  <input
                    className="input"
                    type="number"
                    min={0}
                    style={{ maxWidth: 220 }}
                    value={drafts[key] ?? ''}
                    onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                    dir="ltr"
                  />
                ) : (
                  <input
                    className="input"
                    value={drafts[key] ?? ''}
                    onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                    dir={key.startsWith('site_name_ar') || key.endsWith('_ar') ? 'rtl' : 'ltr'}
                  />
                )}

                <div className="row" style={{ gap: 6 }}>
                  <Button size="sm" loading={saving === key} disabled={!dirty} onClick={() => save(key)} icon="check">
                    {t('common.save')}
                  </Button>
                  {overridden && (
                    <Button size="sm" variant="ghost" loading={saving === key} onClick={() => reset(key)} icon="refresh">
                      {t('admin.settingsReset')}
                    </Button>
                  )}
                  {dirty && (
                    <button
                      type="button"
                      className="chip tiny"
                      onClick={() =>
                        setDrafts({
                          ...drafts,
                          [key]: typeof data.effective[key] === 'boolean' ? data.effective[key] : String(data.effective[key] ?? ''),
                        })
                      }
                    >
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminStaff() {
  const { t, toast, errorMessage, user } = useApp();
  const [items, setItems] = useState(null);
  const [permInput, setPermInput] = useState('');
  const [selected, setSelected] = useState(null);

  const PERMS = [
    'dashboard.view', 'users.view', 'users.edit', 'users.status', 'users.verify', 'users.roles',
    'listings.view', 'listings.moderate', 'listings.edit', 'listings.delete',
    'stores.view', 'stores.moderate', 'stores.verify', 'reports.view', 'reports.handle',
    'finance.view', 'finance.manage', 'plans.manage', 'coupons.manage',
    'platform.content', 'platform.geo', 'platform.categories', 'platform.settings',
    'platform.notifications', 'audit.view', 'staff.manage',
  ];

  const load = useCallback(() => {
    api.get('/admin/staff').then((r) => setItems(r.items)).catch((err) => toast(errorMessage(err), 'error'));
  }, [toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const savePerms = async (staff, perms) => {
    try {
      await api.post(`/admin/users/${staff.id}/permissions`, { permissions: perms });
      toast(t('account.saved'), 'success');
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1 style={{ fontSize: '1.3rem' }}>{t('admin.staff')}</h1>
      <Alert type="info" icon="shield">
        Roles are hierarchical. Nobody can grant a role equal to or above their own, and staff cannot edit their own permissions.
      </Alert>

      {!items && <div className="skeleton" style={{ height: 260 }} />}

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Staff</th><th>Role</th><th>Extra permissions</th><th /></tr></thead>
          <tbody>
            {items?.map((s) => (
              <tr key={s.id}>
                <td>
                  <b className="small">{s.name}</b>
                  <div className="tiny muted" dir="ltr">{s.email}</div>
                </td>
                <td><span className="chip chip-brand tiny">{s.role}</span></td>
                <td>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
                    {s.extra_permissions.length === 0 && <span className="tiny muted">—</span>}
                    {s.extra_permissions.map((p) => <span key={p} className="chip tiny">{p}</span>)}
                  </div>
                </td>
                <td>
                  {s.role !== 'superadmin' && s.id !== user.id ? (
                    <Button size="sm" variant="ghost" icon="settings" onClick={() => { setSelected(s); setPermInput(s.extra_permissions.join(',')); }} />
                  ) : (
                    <span className="tiny muted">locked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card card-pad stack" style={{ gap: 10 }}>
          <div className="row-between">
            <b className="small">{selected.name} — extra permissions</b>
            <Button size="sm" variant="ghost" icon="close" onClick={() => setSelected(null)} />
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {PERMS.map((p) => {
              const list = permInput.split(',').map((x) => x.trim()).filter(Boolean);
              const on = list.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  className={`chip ${on ? 'chip-brand' : ''}`}
                  style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                  onClick={() => {
                    const next = on ? list.filter((x) => x !== p) : [...list, p];
                    setPermInput(next.join(','));
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            style={{ width: 'fit-content' }}
            icon="check"
            onClick={() => savePerms(selected, permInput.split(',').map((x) => x.trim()).filter(Boolean))}
          >
            {t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}

/* =========================== audit log =========================== */

export function AdminAudit() {
  const { t, lang, toast, errorMessage } = useApp();
  const [items, setItems] = useState(null);
  const [action, setAction] = useState('');

  const load = useCallback(() => {
    setItems(null);
    api.get(`/admin/audit?limit=200${action ? `&action=${encodeURIComponent(action)}` : ''}`)
      .then((r) => setItems(r.items))
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [action, toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.3rem' }}>{t('admin.audit')}</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="row" style={{ gap: 6 }}>
          <input className="input" style={{ width: 200 }} placeholder="action filter" value={action} onChange={(e) => setAction(e.target.value)} />
          <Button size="sm" variant="outline" type="submit" icon="search" />
        </form>
      </div>

      {!items && <div className="skeleton" style={{ height: 320 }} />}
      {items && items.length === 0 && <div className="card"><EmptyState icon="clock" title="—" /></div>}

      {items && items.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>IP</th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="tiny nowrap">{formatDate(a.created_at, lang, { withTime: true })}</td>
                  <td className="small">{a.actor_name || '—'} {a.actor_role && <span className="chip tiny">{a.actor_role}</span>}</td>
                  <td className="tiny strong" dir="ltr">{a.action}</td>
                  <td className="tiny muted">{a.entity_type ? `${a.entity_type}#${a.entity_id}` : '—'}</td>
                  <td className="tiny muted" dir="ltr">{a.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
