import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Alert, Button, ConfirmDialog, EmptyState, Field, Modal } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api } from '../../lib/api.js';
import { pickName } from '../../lib/format.js';

/* =========================== categories =========================== */

export function AdminCategories() {
  const { t, lang, toast, errorMessage } = useApp();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name_ar: '', name_fr: '', name_en: '', icon: 'box', color: '#0f9b88', parent_id: '', sort: 0 });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/categories').then((r) => setItems(r.items)).catch((err) => toast(errorMessage(err), 'error'));
  }, [toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = (parentId = '') => {
    setEditing({ id: null });
    setForm({ name_ar: '', name_fr: '', name_en: '', icon: 'box', color: '#0f9b88', parent_id: parentId, sort: 0 });
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name_ar: c.name_ar,
      name_fr: c.name_fr,
      name_en: c.name_en,
      icon: c.icon || 'box',
      color: c.color || '#0f9b88',
      parent_id: c.parent_id || '',
      sort: c.sort || 0,
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        name_ar: form.name_ar,
        name_fr: form.name_fr,
        name_en: form.name_en,
        icon: form.icon,
        color: form.color,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        sort: Number(form.sort) || 0,
      };
      if (editing.id) await api.patch(`/admin/categories/${editing.id}`, payload);
      else await api.post('/admin/categories', payload);
      toast(t('account.saved'), 'success');
      setEditing(null);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (c) => {
    try {
      await api.patch(`/admin/categories/${c.id}`, { active: !c.active });
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await api.del(`/admin/categories/${confirmDelete.id}`);
      toast(res.deactivated ? 'deactivated (in use)' : 'deleted', 'success');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const roots = items?.filter((c) => !c.parent_id) || [];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem' }}>{t('admin.categories')}</h1>
          <p className="tiny muted">{items?.length || 0} categories / subcategories</p>
        </div>
        <Button onClick={() => openNew()} icon="plus" size="sm">{t('common.edit')}</Button>
      </div>

      {!items && <div className="skeleton" style={{ height: 320 }} />}

      <div className="stack" style={{ gap: 8 }}>
        {roots.map((c) => (
          <div key={c.id} className="card" style={{ padding: 12 }}>
            <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div className="row" style={{ gap: 9 }}>
                <span className="stat-icon" style={c.color ? { color: c.color, background: `${c.color}14` } : undefined}>
                  <Icon name={c.icon || 'box'} size={16} />
                </span>
                <div>
                  <div className="row" style={{ gap: 6 }}>
                    <b className="small">{c.name_ar}</b>
                    <span className="tiny muted">{c.name_fr}</span>
                    {!c.active && <span className="chip chip-danger tiny">inactive</span>}
                  </div>
                  <span className="tiny muted">{c.listings_count} listings · /{c.slug}</span>
                </div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <Button size="sm" variant="ghost" onClick={() => openNew(c.id)} icon="plus" title="add subcategory" />
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)} icon="edit" />
                <Button size="sm" variant="ghost" onClick={() => toggleActive(c)} icon={c.active ? 'ban' : 'check'} />
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c)} icon="trash" />
              </div>
            </div>
            {(c.children || []).length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {items.filter((x) => x.parent_id === c.id).map((ch) => (
                  <span key={ch.id} className="chip tiny" style={{ gap: 6 }}>
                    {ch.name_ar}
                    <button type="button" onClick={() => openEdit(ch)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'grid' }}>
                      <Icon name="edit" size={10} />
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(ch)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, display: 'grid' }}>
                      <Icon name="close" size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? t('common.edit') : t('common.edit')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} type="button">{t('common.cancel')}</Button>
            <Button onClick={save} loading={busy} type="button" icon="check">{t('common.save')}</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="الاسم (عربي)" required><input className="input" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label="Nom (FR)" required><input className="input" value={form.name_fr} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} dir="ltr" /></Field>
          <Field label="Name (EN)" required><input className="input" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} dir="ltr" /></Field>
          <Field label="Icon"><input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} dir="ltr" placeholder="car" /></Field>
          <Field label="Color"><input type="color" className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ padding: 4, height: 42 }} /></Field>
          <Field label="Parent">
            <select className="select" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
              <option value="">— root —</option>
              {roots.filter((r) => r.id !== editing?.id).map((r) => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
            </select>
          </Field>
          <Field label="Sort"><input type="number" className="input" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} dir="ltr" /></Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title={t('common.delete')}
        message={confirmDelete?.name_ar}
        confirmLabel={t('common.delete')}
        danger
        loading={busy}
        onClose={() => setConfirmDelete(null)}
        onConfirm={remove}
      />
    </div>
  );
}

/* =========================== cities / areas =========================== */

export function AdminCities() {
  const { t, lang, toast, errorMessage } = useApp();
  const [items, setItems] = useState(null);
  const [areas, setAreas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name_ar: '', name_fr: '', name_en: '', region: '' });
  const [areaName, setAreaName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/cities').then((r) => setItems(r.items)).catch((err) => toast(errorMessage(err), 'error'));
  }, [toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const openAreas = async (city) => {
    setSelected(city);
    const r = await api.get(`/admin/cities/${city.id}/areas`);
    setAreas(r.items);
  };

  const createCity = async () => {
    setBusy(true);
    try {
      await api.post('/admin/cities', { ...form, active: true });
      setForm({ name_ar: '', name_fr: '', name_en: '', region: '' });
      load();
      toast(t('account.saved'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addArea = async () => {
    if (!areaName.trim()) return;
    try {
      await api.post(`/admin/cities/${selected.id}/areas`, { name_ar: areaName, name_fr: areaName, name_en: areaName });
      setAreaName('');
      openAreas(selected);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const removeArea = async (area) => {
    try {
      await api.del(`/admin/areas/${area.id}`);
      openAreas(selected);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1 style={{ fontSize: '1.3rem' }}>{t('admin.cities')}</h1>

      <div className="card card-pad" style={{ display: 'grid', gap: 10 }}>
        <b className="small">{t('store.create')} — city</b>
        <div className="form-grid">
          <input className="input" placeholder="الاسم بالعربية" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          <input className="input" placeholder="Nom FR" value={form.name_fr} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} dir="ltr" />
          <input className="input" placeholder="Name EN" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} dir="ltr" />
          <input className="input" placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </div>
        <Button size="sm" onClick={createCity} loading={busy} style={{ width: 'fit-content' }} icon="plus">{t('common.save')}</Button>
      </div>

      {!items && <div className="skeleton" style={{ height: 300 }} />}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>City</th><th>Region</th><th>Listings</th><th>Areas</th><th /></tr>
          </thead>
          <tbody>
            {items?.map((c) => (
              <tr key={c.id}>
                <td>
                  <b className="small">{c.name_ar}</b>
                  <span className="tiny muted"> / {c.name_fr} · {c.slug}</span>
                </td>
                <td className="tiny">{c.region || '—'}</td>
                <td>{c.listings_count}</td>
                <td>{c.areas_count}</td>
                <td><Button size="sm" variant="ghost" onClick={() => openAreas(c)} icon="mapPin">{t('filters.city')}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`${selected?.name_ar || ''} — areas`}>
        <div className="row" style={{ gap: 6 }}>
          <input className="input" value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="اسم المنطقة / quartier" />
          <Button size="sm" onClick={addArea} icon="plus">{t('common.save')}</Button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {areas.length === 0 && <span className="tiny muted">—</span>}
          {areas.map((a) => (
            <span key={a.id} className="chip tiny" style={{ gap: 6 }}>
              {a.name_ar}
              <button type="button" onClick={() => removeArea(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, display: 'grid' }}>
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
        </div>
      </Modal>
    </div>
  );
}
