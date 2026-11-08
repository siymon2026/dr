import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Alert, Button, Field, Modal } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { pickName } from '../lib/format.js';

const CONDITIONS = ['new', 'used_excellent', 'used_good', 'needs_repair'];
const MAX_PHOTOS = 15;

function PhotoManager({ listingId, images, setImages, toast, errorMessage, t }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const remaining = MAX_PHOTOS - images.length;

  const upload = async (fileList) => {
    if (!listingId) {
      toast(t('post.formRequired'), 'error');
      return;
    }
    const files = Array.from(fileList || []).slice(0, Math.max(0, remaining));
    if (!files.length) {
      toast(t('errors.too_many_images'), 'error');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append('images', f));
      const res = await api.upload(`/uploads/listing/${listingId}`, form);
      setImages((prev) => [...prev, ...res.images.map((i) => ({ ...i, thumb: i.path }))]);
      toast(`${res.images.length} ✓`, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (image) => {
    try {
      await api.del(`/uploads/listing/${listingId}/${image.id}`);
      setImages((prev) => prev.filter((i) => i.id !== image.id));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const makePrimary = async (image) => {
    try {
      await api.post(`/uploads/listing/${listingId}/primary/${image.id}`, {});
      setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === image.id })));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <div
        className={`dropzone ${dragging ? 'drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        {uploading ? (
          <>
            <span className="spinner spinner-dark" />
            <span>{t('common.loading')}</span>
          </>
        ) : (
          <>
            <Icon name="upload" size={26} style={{ color: 'var(--brand-600)' }} />
            <b>{remaining > 0 ? t('post.field.photos') : t('errors.too_many_images')}</b>
            <span className="tiny">{t('post.field.photosHint')}</span>
            <span className="chip chip-brand tiny">{images.length} / {MAX_PHOTOS}</span>
          </>
        )}
      </div>

      {images.length > 0 && (
        <div className="thumb-grid">
          {images.map((img) => (
            <div key={img.id} className={`thumb ${img.is_primary ? 'primary' : ''}`}>
              <img src={img.thumb || img.path} alt="" />
              <button type="button" className="thumb-del" onClick={() => remove(img)} aria-label={t('post.removePhoto')}>
                <Icon name="close" size={12} />
              </button>
              {!img.is_primary && (
                <button type="button" className="thumb-star" onClick={() => makePrimary(img)}>
                  ★ {t('post.primary')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostListing({ edit = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang, user, categories, cities, toast, errorMessage, refreshSession } = useApp();
  const [step, setStep] = useState(1);
  const [listingId, setListingId] = useState(null);
  const [images, setImages] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [done, setDone] = useState(null);
  const [areas, setAreas] = useState([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_parent: '',
    category_id: '',
    price: '',
    negotiable: false,
    condition: 'used_good',
    city_id: user?.city_id ? String(user.city_id) : '',
    area_id: '',
    contact_phone: user?.phone || '',
  });

  useEffect(() => {
    if (!user) navigate('/login?next=/post', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    api.get('/listings/quota/me').then(setQuota).catch(() => {});
  }, []);

  useEffect(() => {
    if (!edit || !id) return;
    api
      .get(`/listings/${id}`)
      .then((res) => {
        const l = res.listing;
        setListingId(l.id);
        const parent = categories.find((c) => c.id === l.category.id || (c.children || []).some((ch) => ch.id === l.category.id));
        setForm({
          title: l.title,
          description: l.description,
          category_parent: parent ? String(parent.id) : '',
          category_id: String(l.category.id),
          price: String(l.price || ''),
          negotiable: !!l.negotiable,
          condition: l.condition,
          city_id: String(l.city.id),
          area_id: l.area ? String(l.area.id) : '',
          contact_phone: l.contact_phone || user?.phone || '',
        });
        setImages((l.images || []).map((i) => ({ ...i, thumb: i.thumb || i.path })));
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [edit, id, categories, errorMessage, user?.phone]);

  useEffect(() => {
    if (!form.city_id) {
      setAreas([]);
      return;
    }
    api.get(`/geo/cities/${form.city_id}/areas`).then((r) => setAreas(r.items)).catch(() => setAreas([]));
  }, [form.city_id]);

  const parentCategory = categories.find((c) => String(c.id) === form.category_parent);
  const subcategories = parentCategory?.children || [];

  const validateStep1 = () => {
    const errs = {};
    if (form.title.trim().length < 6) errs.title = t('common.required');
    if (form.description.trim().length < 20) errs.description = t('common.required');
    if (!form.category_id) errs.category_id = t('common.required');
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (form.price === '' || Number(form.price) < 0) errs.price = t('common.required');
    if (!form.city_id) errs.city_id = t('common.required');
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    if (!validateStep1() || !validateStep2()) {
      setStep(1);
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category_id: Number(form.category_id),
      price_cents: Math.round(Number(form.price || 0) * 100),
      negotiable: form.negotiable,
      condition: form.condition,
      city_id: Number(form.city_id),
      area_id: form.area_id ? Number(form.area_id) : null,
      contact_phone: form.contact_phone || null,
    };
    try {
      if (edit) {
        await api.patch(`/listings/${listingId}`, payload);
        toast(t('account.saved'), 'success');
        navigate('/my-listings');
        return;
      }
      const res = await api.post('/listings', payload);
      setListingId(res.id);
      setDone(res);
      refreshSession().catch(() => {});
      if (images.length === 0) {
        // photos are uploaded right after creation in the same flow
      }
      setStep(3);
    } catch (err) {
      setError(errorMessage(err));
      if (err.details) setFieldErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="container" style={{ padding: '40px 0' }}>
        <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  if (done) {
    return (
      <div className="container" style={{ maxWidth: 680, padding: '40px 0 60px' }}>
        <div className="card card-pad" style={{ display: 'grid', gap: 18, justifyItems: 'center', textAlign: 'center' }}>
          <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--brand-50)', color: 'var(--brand-600)', display: 'grid', placeItems: 'center' }}>
            <Icon name={done.status === 'active' ? 'checkCircle' : 'clock'} size={32} />
          </span>
          <h1 style={{ fontSize: '1.3rem' }}>
            {done.status === 'active'
              ? lang === 'ar' ? 'تم نشر إعلانك!' : lang === 'fr' ? 'Annonce publiée !' : 'Listing published!'
              : t('myListings.pending')}
          </h1>
          <p className="muted small" style={{ maxWidth: 420 }}>
            {done.status === 'active' ? t('post.subtitle') : t('post.pending')}
          </p>
          <div className="stack" style={{ width: '100%', gap: 10, marginTop: 4 }}>
            <h3 className="small strong" style={{ textAlign: 'start' }}>{t('post.field.photos')}</h3>
            <PhotoManager listingId={done.id} images={images} setImages={setImages} toast={toast} errorMessage={errorMessage} t={t} />
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
            <Link to={`/listing/${done.public_id}`} className="btn btn-outline">{t('common.viewAll')}</Link>
            <Link to="/my-listings" className="btn">{t('nav.myListings')}</Link>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/post')}>{t('myListings.add')}</button>
          </div>
        </div>
      </div>
    );
  }

  const quotaFull = quota && quota.remaining <= 0 && !edit;

  return (
    <div className="container" style={{ maxWidth: 860, paddingTop: 24, paddingBottom: 50 }}>
      <div className="row-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.25rem,3vw,1.65rem)' }}>{edit ? t('myListings.edit') : t('post.title')}</h1>
          <p className="small muted">{t('post.subtitle')}</p>
        </div>
        {quota && !edit && (
          <span className={`chip ${quotaFull ? 'chip-danger' : 'chip-brand'}`}>
            <Icon name="list" size={13} />
            {t('post.quota', { used: quota.used, quota: quota.quota })}
          </span>
        )}
      </div>

      {quotaFull && (
        <Alert type="warning" icon="alert">
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span>{t('post.quotaFull')}</span>
            <Link to="/pricing" className="btn btn-sm btn-accent">{t('nav.pricing')}</Link>
          </div>
        </Alert>
      )}

      {error && <Alert type="error">{error}</Alert>}

      <div className="row" style={{ gap: 6, margin: '14px 0', flexWrap: 'wrap' }}>
        {(edit ? [{ n: 1, label: t('post.section.basic') }, { n: 2, label: t('post.section.price') }, { n: 3, label: t('post.field.photos') }] : [
          { n: 1, label: t('post.section.basic') },
          { n: 2, label: t('post.section.price') },
          { n: 3, label: t('post.field.photos') },
        ]).map((s) => (
          <button
            key={s.n}
            type="button"
            className={`chip ${step === s.n ? 'chip-brand' : ''}`}
            onClick={() => setStep(s.n)}
            style={{ cursor: 'pointer', border: step === s.n ? undefined : '1px solid var(--border)' }}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      <div className="card card-pad" style={{ display: 'grid', gap: 16 }}>
        {step === 1 && (
          <>
            <h2 className="section-title" style={{ fontSize: '1rem' }}><span className="dot" style={{ height: 16 }} /> {t('post.section.basic')}</h2>
            <Field label={t('post.field.title')} error={fieldErrors.title} hint={t('post.field.titleHint')} required>
              <input
                className={`input ${fieldErrors.title ? 'invalid' : ''}`}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={110}
                placeholder={t('post.field.titleHint')}
              />
            </Field>
            <div className="form-grid">
              <Field label={t('post.field.category')} error={fieldErrors.category_id} required>
                <select
                  className="select"
                  value={form.category_parent}
                  onChange={(e) => {
                    const parent = categories.find((c) => String(c.id) === e.target.value);
                    setForm({
                      ...form,
                      category_parent: e.target.value,
                      category_id: parent && !(parent.children || []).length ? String(parent.id) : '',
                    });
                  }}
                >
                  <option value="">{t('filters.allCategories')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{pickName(c.name, lang)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('post.field.subcategory')}>
                <select
                  className="select"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  disabled={!subcategories.length}
                >
                  <option value="">{subcategories.length ? '—' : t('post.field.subcategory')}</option>
                  {subcategories.map((c) => (
                    <option key={c.id} value={c.id}>{pickName(c.name, lang)}</option>
                  ))}
                  {!subcategories.length && parentCategory && <option value={parentCategory.id}>{pickName(parentCategory.name, lang)}</option>}
                </select>
              </Field>
            </div>
            <Field label={t('post.field.description')} error={fieldErrors.description} hint={t('post.field.descriptionHint')} required>
              <textarea
                className={`textarea ${fieldErrors.description ? 'invalid' : ''}`}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={4000}
                style={{ minHeight: 150 }}
              />
              <span className="hint" style={{ textAlign: 'end' }}>{form.description.length} / 4000</span>
            </Field>
            <Field label={t('post.field.condition')} required>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`chip ${form.condition === c ? 'chip-brand' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setForm({ ...form, condition: c })}
                  >
                    {t(`listing.condition.${c}`)}
                  </button>
                ))}
              </div>
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <Button type="button" onClick={() => (validateStep1() ? setStep(2) : null)} disabled={quotaFull} iconRight="chevronLeft">
                {t('common.next')}
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="section-title" style={{ fontSize: '1rem' }}><span className="dot" style={{ height: 16 }} /> {t('post.section.price')}</h2>
            <div className="form-grid">
              <Field label={t('post.field.price')} error={fieldErrors.price} required>
                <div className="row" style={{ gap: 6 }}>
                  <input
                    className={`input ${fieldErrors.price ? 'invalid' : ''}`}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    dir="ltr"
                  />
                  <span className="chip" style={{ height: 42 }}>MAD</span>
                </div>
              </Field>
              <Field label={t('post.field.negotiable')}>
                <label className="checkbox" style={{ height: 42, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={form.negotiable}
                    onChange={(e) => setForm({ ...form, negotiable: e.target.checked })}
                  />
                  <span>{t('post.field.negotiable')}</span>
                </label>
              </Field>
            </div>

            <h2 className="section-title" style={{ fontSize: '1rem', marginTop: 6 }}><span className="dot" style={{ height: 16 }} /> {t('post.section.location')}</h2>
            <div className="form-grid">
              <Field label={t('post.field.city')} error={fieldErrors.city_id} required>
                <select
                  className={`select ${fieldErrors.city_id ? 'invalid' : ''}`}
                  value={form.city_id}
                  onChange={(e) => setForm({ ...form, city_id: e.target.value, area_id: '' })}
                >
                  <option value="">{t('filters.city')}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{pickName(c.name, lang)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('post.field.area')} hint={t('common.optional')}>
                <select
                  className="select"
                  value={form.area_id}
                  onChange={(e) => setForm({ ...form, area_id: e.target.value })}
                  disabled={!areas.length}
                >
                  <option value="">—</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{pickName(a.name, lang)}</option>
                  ))}
                </select>
              </Field>
            </div>

            <h2 className="section-title" style={{ fontSize: '1rem', marginTop: 6 }}><span className="dot" style={{ height: 16 }} /> {t('post.section.contact')}</h2>
            <Field label={t('post.field.phone')} hint={t('account.showPhone')}>
              <input
                className="input"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="06XXXXXXXX"
                dir="ltr"
              />
            </Field>

            <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <Button type="button" variant="ghost" onClick={() => setStep(1)} icon="chevronRight">{t('common.prev')}</Button>
              {edit ? (
                <Button type="button" onClick={submit} loading={saving} icon="check">{t('common.save')}</Button>
              ) : (
                <Button type="button" onClick={() => (validateStep2() ? setStep(3) : null)} iconRight="chevronLeft">{t('common.next')}</Button>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="section-title" style={{ fontSize: '1rem' }}><span className="dot" style={{ height: 16 }} /> {t('post.section.photos')}</h2>
            {listingId ? (
              <PhotoManager listingId={listingId} images={images} setImages={setImages} toast={toast} errorMessage={errorMessage} t={t} />
            ) : (
              <>
                <Alert type="info" icon="info">{t('post.field.photosHint')}</Alert>
                <Button type="button" onClick={submit} loading={saving} className="btn-block btn-lg" icon="plus" disabled={quotaFull}>
                  {t('post.submit')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStep(2)} icon="chevronRight">{t('common.prev')}</Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
