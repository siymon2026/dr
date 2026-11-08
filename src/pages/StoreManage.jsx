import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Alert, Avatar, Button, EmptyState, Field, Stars } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatNumber, pickName, timeAgo } from '../lib/format.js';

export default function StoreManage() {
  const { t, lang, user, cities, toast, errorMessage, refreshSession } = useApp();
  const navigate = useNavigate();
  const [store, setStore] = useState(undefined);
  const [reviews, setReviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoRef = useRef(null);
  const coverRef = useRef(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    city_id: '',
    phone: '',
    whatsapp: '',
    website: '',
  });

  useEffect(() => {
    if (!user) navigate('/login?next=/store/manage', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    api
      .get('/stores/mine')
      .then((res) => {
        setStore(res.store);
        setReviews(res.reviews || []);
        if (res.store) {
          setForm({
            name: res.store.name,
            description: res.store.description || '',
            city_id: res.store.city?.id ? String(res.store.city.id) : '',
            phone: res.store.phone || '',
            whatsapp: res.store.whatsapp || '',
            website: res.store.website || '',
          });
        }
      })
      .catch(() => setStore(null));
  }, [user]);

  if (!user) return null;
  if (store === undefined) {
    return <div className="container" style={{ paddingTop: 30 }}><div className="skeleton" style={{ height: 220 }} /></div>;
  }

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/stores', {
        name: form.name.trim(),
        description: form.description.trim(),
        city_id: Number(form.city_id),
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        website: form.website || null,
      });
      toast(t('store.pending'), 'success');
      refreshSession().catch(() => {});
      const res = await api.get('/stores/mine');
      setStore(res.store);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/stores/${store.id}`, {
        name: form.name.trim(),
        description: form.description.trim(),
        city_id: Number(form.city_id),
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        website: form.website.trim() || null,
      });
      toast(t('account.saved'), 'success');
      const res = await api.get('/stores/mine');
      setStore(res.store);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadAsset = async (file, kind) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append(kind, file);
      const res = await api.upload('/uploads/store-assets', fd);
      await api.patch(`/stores/${store.id}`, { [kind]: res[kind] });
      const fresh = await api.get('/stores/mine');
      setStore(fresh.store);
      toast(t('account.saved'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLogoBusy(false);
    }
  };

  if (!store) {
    return (
      <div className="container" style={{ maxWidth: 620, paddingTop: 30, paddingBottom: 50 }}>
        <h1 style={{ fontSize: '1.4rem', marginBottom: 6 }}>{t('store.create')}</h1>
        <p className="small muted" style={{ marginBottom: 18 }}>
          {t('store.createSub')}
        </p>
        <form className="card card-pad stack" style={{ gap: 14 }} onSubmit={create}>
          <Field label={t('store.name')} required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={3} maxLength={80} />
          </Field>
          <div className="form-grid">
            <Field label={t('filters.city')} required>
              <select className="select" value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })} required>
                <option value="">—</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{pickName(c.name, lang)}</option>)}
              </select>
            </Field>
            <Field label={t('auth.phone')} hint={t('common.optional')}>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" placeholder="06XXXXXXXX" />
            </Field>
          </div>
          <Field label={t('store.description')} required>
            <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} minLength={20} maxLength={2000} required />
          </Field>
          <Alert type="info" icon="info">
            {lang === 'ar'
              ? 'تخضع المتاجر للمراجعة الإدارية قبل النشر. ستحصل على إشعار عند الموافقة.'
              : 'Les boutiques sont validées par notre équipe avant publication.'}
          </Alert>
          <Button type="submit" loading={busy} icon="store" style={{ width: 'fit-content' }}>{t('store.create')}</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 860, paddingTop: 24, paddingBottom: 44 }}>
      <div className="row-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 'clamp(1.2rem,3vw,1.5rem)' }}>{t('store.myStore')}</h1>
        <div className="row" style={{ gap: 8 }}>
          {store.status === 'active' && (
            <Link to={`/stores/${store.slug}`} className="btn btn-outline btn-sm"><Icon name="external" size={14} /> {t('listing.viewStore')}</Link>
          )}
          <Link to="/my-listings" className="btn btn-sm"><Icon name="list" size={14} /> {t('nav.myListings')}</Link>
        </div>
      </div>

      {store.status !== 'active' && (
        <Alert type={store.status === 'rejected' || store.status === 'suspended' ? 'error' : 'warning'} icon="clock">
          {t(`notif.store_${store.status}`)}
          {store.status_reason ? ` — ${store.status_reason}` : ''}
        </Alert>
      )}
      {store.verified && (
        <Alert type="success" icon="verified">{t('store.verified')}</Alert>
      )}

      <div className="kpi-grid mt-2" style={{ marginBottom: 16 }}>
        {[
          { label: t('store.products'), value: store.listings_count || 0, icon: 'bag' },
          { label: t('store.followers'), value: formatNumber(store.followers, lang), icon: 'users' },
          { label: t('listing.views'), value: formatNumber(store.views, lang), icon: 'eye' },
          { label: t('store.sales'), value: store.sales, icon: 'checkCircle' },
        ].map((k) => (
          <div key={k.label} className="stat-card">
            <div className="row-between"><span className="label">{k.label}</span><span className="stat-icon"><Icon name={k.icon} size={16} /></span></div>
            <span className="value">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="card card-pad row" style={{ gap: 12, flex: '1 1 260px' }}>
          <Avatar src={store.logo} name={store.name} size="lg" />
          <div className="stack" style={{ gap: 4 }}>
            <b className="small">{t('store.logo')}</b>
            <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => uploadAsset(e.target.files?.[0], 'logo')} />
            <Button type="button" size="sm" variant="outline" loading={logoBusy} onClick={() => logoRef.current?.click()} icon="upload">{t('common.edit')}</Button>
          </div>
        </div>
        <div className="card card-pad row" style={{ gap: 12, flex: '1 1 260px' }}>
          {store.cover ? <img src={store.cover} alt="" style={{ width: 84, height: 54, borderRadius: 8, objectFit: 'cover' }} loading="lazy" decoding="async" /> : <span className="stat-icon" style={{ width: 54, height: 54 }}><Icon name="image" size={20} /></span>}
          <div className="stack" style={{ gap: 4 }}>
            <b className="small">{t('store.cover')}</b>
            <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => uploadAsset(e.target.files?.[0], 'cover')} />
            <Button type="button" size="sm" variant="outline" loading={logoBusy} onClick={() => coverRef.current?.click()} icon="upload">{t('common.edit')}</Button>
          </div>
        </div>
      </div>

      <form className="card card-pad stack" style={{ gap: 14 }} onSubmit={save}>
        <div className="form-grid">
          <Field label={t('store.name')} required>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={3} maxLength={80} />
          </Field>
          <Field label={t('filters.city')} required>
            <select className="select" value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })} required>
              <option value="">—</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{pickName(c.name, lang)}</option>)}
            </select>
          </Field>
          <Field label={t('auth.phone')}><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></Field>
          <Field label={t('store.whatsapp')}><input className="input" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} dir="ltr" placeholder="06XXXXXXXX" /></Field>
          <Field label={t('store.website')} hint={t('common.optional')}>
            <input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} dir="ltr" placeholder="https://" />
          </Field>
        </div>
        <Field label={t('store.description')} required>
          <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} minLength={20} maxLength={2000} required />
        </Field>
        <Button type="submit" loading={busy} icon="check" style={{ width: 'fit-content' }}>{t('common.save')}</Button>
      </form>

      <div className="card card-pad mt-3">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <h3 className="small strong">{t('store.reviews')} ({store.rating_count || 0})</h3>
          <Stars value={store.rating_avg} count={store.rating_count} size={14} />
        </div>
        {reviews.length === 0 ? (
          <EmptyState icon="star" title={t('store.noReviews')} />
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {reviews.map((r, i) => (
              <div key={i} className="stack" style={{ gap: 4, paddingBottom: 8, borderBottom: i < reviews.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div className="row-between">
                  <div className="row" style={{ gap: 6 }}>
                    <b className="small">{r.reviewer_name}</b>
                    <Stars value={r.rating} size={12} />
                  </div>
                  <span className="tiny muted">{timeAgo(r.created_at, t)}</span>
                </div>
                {r.comment && <p className="small muted">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
