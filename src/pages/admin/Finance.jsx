import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Alert, Button, EmptyState, Modal, StatCard, StatusChip, Tabs } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api, qs } from '../../lib/api.js';
import { formatDate, formatPrice } from '../../lib/format.js';

export function AdminFinance() {
  const { t, lang, user, toast, errorMessage } = useApp();
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState(null);
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('orders');
  const [subs, setSubs] = useState(null);

  const canManage = user?.permissions?.includes('finance.manage');

  const load = useCallback(() => {
    setOrders(null);
    api.get('/admin/finance/summary').then(setSummary).catch((err) => toast(errorMessage(err), 'error'));
    api.get(`/admin/orders${qs({ status: status === 'all' ? '' : status, limit: 60 })}`).then((r) => setOrders(r.items)).catch(() => setOrders([]));
    api.get('/admin/subscriptions?limit=100').then(setSubs).catch(() => setSubs({ items: [], stats: {} }));
  }, [status, toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const markPaid = async (order) => {
    setBusy(true);
    try {
      await api.post(`/admin/orders/${order.id}/pay`, {});
      toast(t('notif.order_paid'), 'success');
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.3rem' }}>{t('admin.finance')}</h1>
        <a href="/api/admin/finance/export.csv" className="btn btn-outline btn-sm" download>
          <Icon name="download" size={15} /> {t('admin.export')}
        </a>
      </div>

      <Alert type="info" icon="info">
        Payment provider: <b>not configured</b> — real online payments are disabled until CMI/Stripe keys and webhooks are verified. Offline settlement below is audit-logged.
      </Alert>

      <div className="kpi-grid">
        <StatCard label={t('admin.revenue')} value={summary ? formatPrice(summary.revenue_total, 'MAD', lang) : '—'} icon="money" />
        {summary?.by_kind?.map((k) => (
          <StatCard key={k.kind} label={`${k.kind} (${k.c})`} value={formatPrice(k.total, 'MAD', lang)} icon="card" />
        ))}
        {summary?.by_provider?.map((p) => (
          <StatCard key={p.provider} label={`provider: ${p.provider}`} value={formatPrice(p.total, 'MAD', lang)} icon="wallet" />
        ))}
      </div>

      <Tabs
        items={[
          { value: 'orders', label: t('admin.orders') },
          { value: 'subscriptions', label: t('admin.subscriptions') },
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'subscriptions' && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="kpi-grid">
            <StatCard label={t('admin.subscriptions')} value={subs?.stats?.active ?? '—'} icon="crown" />
            <StatCard label={t('admin.revenue')} value={subs ? formatPrice(subs.stats?.mrr || 0, 'MAD', lang) : '—'} icon="money" />
            <StatCard label={t('admin.expiredSubs')} value={subs?.stats?.expired ?? '—'} icon="clock" />
          </div>
          {!subs && <div className="skeleton" style={{ height: 240 }} />}
          {subs && subs.items.length === 0 && <div className="card"><EmptyState icon="crown" title={t('search.noResults')} /></div>}
          {subs && subs.items.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('admin.users')}</th>
                    <th>{t('admin.plans')}</th>
                    <th>{t('admin.expiresAt')}</th>
                    <th>{t('admin.daysLeft')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.items.map((s2) => (
                    <tr key={s2.id}>
                      <td>
                        <b className="small">{s2.user_name}</b>
                        <div className="tiny muted" dir="ltr">{s2.email}</div>
                      </td>
                      <td className="small">{s2.name?.[lang] || s2.plan_code}</td>
                      <td className="tiny nowrap">{formatDate(s2.ends_at, lang)}</td>
                      <td className="tiny">{s2.days_left}</td>
                      <td><StatusChip status={s2.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'orders' && !orders && <div className="skeleton" style={{ height: 280 }} />}
      {view === 'orders' && orders && orders.length === 0 && <div className="card"><EmptyState icon="money" title={t('search.noResults')} /></div>}

      {view === 'orders' && orders && orders.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Reference</th><th>User</th><th>Item</th><th>Amount</th><th>Status</th><th>Created</th><th /></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="tiny" dir="ltr">{o.reference}</td>
                  <td>
                    <b className="small">{o.user_name}</b>
                    <div className="tiny muted" dir="ltr">{o.email}</div>
                  </td>
                  <td className="small">{o.plan_name || o.boost_name || o.listing_title || o.kind}</td>
                  <td className="nowrap">
                    <b>{formatPrice((o.amount_cents - o.discount_cents) / 100, o.currency, lang)}</b>
                    {o.discount_cents > 0 && <div className="tiny muted">-{formatPrice(o.discount_cents / 100, o.currency, lang)}</div>}
                  </td>
                  <td><StatusChip status={o.status} /></td>
                  <td className="tiny nowrap">{formatDate(o.created_at, lang, { withTime: true })}</td>
                  <td>
                    {canManage && o.status === 'pending' && (
                      <Button size="sm" variant="soft" loading={busy} onClick={() => markPaid(o)} type="button" icon="check">
                        {t('admin.activate')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminPlans() {
  const { t, lang, toast, errorMessage } = useApp();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/plans').then(setData).catch((err) => toast(errorMessage(err), 'error'));
  }, [toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const openPlan = (p) => {
    setEditing({ kind: 'plan', id: p?.id });
    setForm(
      p
        ? {
            code: p.code, name_ar: p.name_ar, name_fr: p.name_fr, name_en: p.name_en,
            description_ar: p.description_ar || '', price_mad: (p.price_cents / 100).toFixed(0),
            duration_days: p.duration_days, listing_quota: p.listing_quota, featured_quota: p.featured_quota,
            is_store_plan: !!p.is_store_plan, active: !!p.active, sort: p.sort,
          }
        : { code: '', name_ar: '', name_fr: '', name_en: '', description_ar: '', price_mad: 0, duration_days: 30, listing_quota: 10, featured_quota: 0, is_store_plan: false, active: true, sort: 0 },
    );
  };

  const openBoost = (b) => {
    setEditing({ kind: 'boost', id: b?.id });
    setForm(
      b
        ? { code: b.code, type: b.type, name_ar: b.name_ar, name_fr: b.name_fr, name_en: b.name_en, price_mad: (b.price_cents / 100).toFixed(0), duration_days: b.duration_days, active: !!b.active, sort: b.sort }
        : { code: '', type: 'feature', name_ar: '', name_fr: '', name_en: '', price_mad: 4900, duration_days: 7, active: true, sort: 0 },
    );
  };

  const save = async () => {
    setBusy(true);
    try {
      const common = { name_ar: form.name_ar, name_fr: form.name_fr, name_en: form.name_en, price_cents: Math.round(Number(form.price_mad) * 100), duration_days: Number(form.duration_days), active: form.active, sort: Number(form.sort) || 0 };
      if (editing.kind === 'plan') {
        const payload = { ...common, code: form.code, description_ar: form.description_ar, listing_quota: Number(form.listing_quota), featured_quota: Number(form.featured_quota), is_store_plan: form.is_store_plan };
        if (editing.id) await api.patch(`/admin/plans/${editing.id}`, payload);
        else await api.post('/admin/plans', payload);
      } else {
        const payload = { ...common, code: form.code, type: form.type };
        if (editing.id) await api.patch(`/admin/boosts/${editing.id}`, payload);
        else await api.post('/admin/boosts', payload);
      }
      toast(t('account.saved'), 'success');
      setEditing(null);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (plan) => {
    try {
      await api.del(`/admin/plans/${plan.id}`);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between">
        <h1 style={{ fontSize: '1.3rem' }}>{t('admin.plans')}</h1>
        <Button size="sm" icon="plus" onClick={() => openPlan(null)}>{t('nav.pricing')}</Button>
      </div>

      {!data && <div className="skeleton" style={{ height: 300 }} />}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Price</th><th>Days</th><th>Quota</th><th>Featured</th><th>Active</th><th /></tr>
          </thead>
          <tbody>
            {data?.plans.map((p) => (
              <tr key={p.id}>
                <td className="tiny" dir="ltr">{p.code}</td>
                <td><b className="small">{p.name_ar}</b><div className="tiny muted">{p.name_fr}</div></td>
                <td className="nowrap">{formatPrice(p.price_cents / 100, p.currency, lang)}</td>
                <td>{p.duration_days}</td>
                <td>{p.listing_quota}</td>
                <td>{p.featured_quota}</td>
                <td>{p.active ? <span className="chip chip-success tiny">active</span> : <span className="chip tiny">off</span>}</td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <Button size="sm" variant="ghost" onClick={() => openPlan(p)} icon="edit" />
                    <Button size="sm" variant="ghost" onClick={() => deactivate(p)} icon="ban" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row-between">
        <h2 style={{ fontSize: '1.1rem' }}>{t('pricing.boost')}</h2>
        <Button size="sm" variant="outline" icon="plus" onClick={() => openBoost(null)}>{t('common.edit')}</Button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Code</th><th>Type</th><th>Name</th><th>Price</th><th>Days</th><th>Active</th><th /></tr></thead>
          <tbody>
            {data?.boosts.map((b) => (
              <tr key={b.id}>
                <td className="tiny" dir="ltr">{b.code}</td>
                <td><span className="chip tiny">{b.type}</span></td>
                <td className="small">{b.name_ar}</td>
                <td className="nowrap">{formatPrice(b.price_cents / 100, 'MAD', lang)}</td>
                <td>{b.duration_days}</td>
                <td>{b.active ? '✓' : '—'}</td>
                <td><Button size="sm" variant="ghost" onClick={() => openBoost(b)} icon="edit" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`${t('admin.plans')} — ${editing?.kind || ''}`}
        size={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} type="button">{t('common.cancel')}</Button>
            <Button onClick={save} loading={busy} type="button" icon="check">{t('common.save')}</Button>
          </>
        }
      >
        <div className="form-grid">
          <input className="input" placeholder="code" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} dir="ltr" />
          {editing?.kind === 'boost' && (
            <select className="select" value={form.type || 'feature'} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="feature">feature</option>
              <option value="pin">pin</option>
              <option value="bump">bump</option>
            </select>
          )}
          <input className="input" placeholder="الاسم عربي" value={form.name_ar || ''} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          <input className="input" placeholder="Nom FR" value={form.name_fr || ''} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} dir="ltr" />
          <input className="input" placeholder="Name EN" value={form.name_en || ''} onChange={(e) => setForm({ ...form, name_en: e.target.value })} dir="ltr" />
          <input className="input" type="number" placeholder="price MAD" value={form.price_mad ?? ''} onChange={(e) => setForm({ ...form, price_mad: e.target.value })} dir="ltr" />
          <input className="input" type="number" placeholder="duration_days" value={form.duration_days ?? ''} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} dir="ltr" />
          {editing?.kind === 'plan' && (
            <>
              <input className="input" type="number" placeholder="listing_quota" value={form.listing_quota ?? ''} onChange={(e) => setForm({ ...form, listing_quota: e.target.value })} dir="ltr" />
              <input className="input" type="number" placeholder="featured_quota" value={form.featured_quota ?? ''} onChange={(e) => setForm({ ...form, featured_quota: e.target.value })} dir="ltr" />
              <label className="checkbox"><input type="checkbox" checked={!!form.is_store_plan} onChange={(e) => setForm({ ...form, is_store_plan: e.target.checked })} /><span>store plan</span></label>
            </>
          )}
          <label className="checkbox"><input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><span>active</span></label>
        </div>
      </Modal>
    </div>
  );
}

export function AdminCoupons() {
  const { t, lang, toast, errorMessage } = useApp();
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ code: '', percent: 10, amount_cents: 0, max_uses: 0, expires_at: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/coupons').then((r) => setItems(r.items)).catch((err) => toast(errorMessage(err), 'error'));
  }, [toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/admin/coupons', {
        code: form.code,
        percent: Number(form.percent) || 0,
        amount_cents: Math.round((Number(form.amount_cents) || 0) * 100),
        max_uses: Number(form.max_uses) || 0,
        expires_at: form.expires_at ? Date.parse(form.expires_at) : undefined,
      });
      setForm({ code: '', percent: 10, amount_cents: 0, max_uses: 0, expires_at: '' });
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
      <h1 style={{ fontSize: '1.3rem' }}>{t('admin.coupons')}</h1>

      <div className="card card-pad stack" style={{ gap: 10 }}>
        <div className="form-grid">
          <input className="input" placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} dir="ltr" />
          <input className="input" type="number" placeholder="percent %" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} dir="ltr" />
          <input className="input" type="number" placeholder="fixed MAD" value={form.amount_cents} onChange={(e) => setForm({ ...form, amount_cents: e.target.value })} dir="ltr" />
          <input className="input" type="number" placeholder="max uses (0=∞)" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} dir="ltr" />
          <input className="input" type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} dir="ltr" />
        </div>
        <Button size="sm" onClick={create} loading={busy} style={{ width: 'fit-content' }} icon="plus">{t('common.save')}</Button>
      </div>

      {!items && <div className="skeleton" style={{ height: 200 }} />}
      {items && items.length === 0 && <div className="card"><EmptyState icon="tag" title={t('search.noResults')} /></div>}

      {items && items.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Code</th><th>Discount</th><th>Uses</th><th>Max</th><th>Expires</th><th>Active</th><th /></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="tiny strong" dir="ltr">{c.code}</td>
                  <td className="small">{c.percent ? `${c.percent}%` : formatPrice(c.amount_cents / 100, 'MAD', lang)}</td>
                  <td>{c.uses}</td>
                  <td>{c.max_uses || '∞'}</td>
                  <td className="tiny">{c.expires_at ? formatDate(c.expires_at, lang) : '—'}</td>
                  <td>{c.active ? <span className="chip chip-success tiny">active</span> : <span className="chip tiny">off</span>}</td>
                  <td className="row" style={{ gap: 4 }}>
                    <Button size="sm" variant="ghost" icon={c.active ? 'ban' : 'check'} onClick={async () => { await api.patch(`/admin/coupons/${c.id}`, { active: !c.active }); load(); }} />
                    <Button size="sm" variant="ghost" icon="trash" onClick={async () => { await api.del(`/admin/coupons/${c.id}`); load(); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
