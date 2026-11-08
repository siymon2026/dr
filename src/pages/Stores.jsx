import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Avatar, EmptyState, SkeletonGrid, Stars } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api, qs } from '../lib/api.js';
import { pickName } from '../lib/format.js';

export default function Stores() {
  const { t, lang, cities, cityId } = useApp();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [city, setCity] = useState(cityId ? String(cityId) : '');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const load = (term = q, cityValue = city, p = page) => {
    setItems(null);
    api
      .get(`/stores${qs({ q: term, city: cityValue, page: p, limit: 24 })}`)
      .then((res) => {
        setItems(res.items);
        setPagination(res.pagination);
      })
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 44 }}>
      <div className="row-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.25rem,3vw,1.65rem)' }}>{t('nav.stores')}</h1>
          <p className="small muted">
            {lang === 'ar' ? 'متاجر موثقة وبائعون محترفون في كل المغرب.' : lang === 'fr' ? 'Boutiques vérifiées et vendeurs pro partout au Maroc.' : 'Verified stores and pro sellers across Morocco.'}
          </p>
        </div>
        <Link to="/store/new" className="btn"><Icon name="store" size={16} /> {t('store.create')}</Link>
      </div>

      <form
        className="card card-pad row"
        style={{ gap: 10, marginBottom: 18, flexWrap: 'wrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load(q, city, 1);
        }}
      >
        <div className="row" style={{ flex: '1 1 220px', gap: 8 }}>
          <Icon name="search" size={17} style={{ color: 'var(--ink-400)' }} />
          <input className="input" style={{ border: 'none', background: 'transparent' }} placeholder={t('store.name')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
        </div>
        <select className="select" style={{ maxWidth: 200 }} value={city} onChange={(e) => setCity(e.target.value)} aria-label={t('filters.city')}>
          <option value="">{t('search.allCities')}</option>
          {cities.map((c) => <option key={c.id} value={c.id}>{pickName(c.name, lang)}</option>)}
        </select>
        <button type="submit" className="btn">{t('common.search')}</button>
      </form>

      {!items && <SkeletonGrid count={6} />}

      {items && items.length === 0 && (
        <div className="card">
          <EmptyState
            icon="store"
            title={t('search.noResults')}
            hint={lang === 'ar' ? 'كن أول من ينشئ متجراً في منطقتك.' : 'Soyez le premier à créer une boutique dans votre région.'}
            action={<Link to="/store/new" className="btn mt-2">{t('store.create')}</Link>}
          />
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))' }}>
        {items?.map((s) => (
          <Link key={s.id} to={`/stores/${s.slug}`} className="card" style={{ overflow: 'hidden' }}>
            <div style={{ height: 92, background: 'linear-gradient(135deg, var(--brand-600), var(--brand-800))', position: 'relative' }}>
              {s.cover && <img src={s.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              {s.featured && <span className="flag flag-featured" style={{ position: 'absolute', top: 10, insetInlineEnd: 10 }}>{t('listing.featured')}</span>}
            </div>
            <div style={{ padding: '0 14px 14px', marginTop: -26 }}>
              <Avatar src={s.logo} name={s.name} size="lg" className="avatar-lg" />
              <div className="row" style={{ gap: 5, marginTop: 6 }}>
                <b className="truncate">{s.name}</b>
                {s.verified && <Icon name="verified" size={15} style={{ color: 'var(--brand-600)' }} />}
              </div>
              <div className="tiny muted row" style={{ gap: 4 }}>
                <Icon name="mapPin" size={11} /> {pickName(s.city?.name, lang) || '—'}
              </div>
              <p className="small muted" style={{ marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {s.description}
              </p>
              <div className="row-between" style={{ marginTop: 10 }}>
                <Stars value={s.rating_avg} count={s.rating_count} size={13} />
                <span className="tiny muted row" style={{ gap: 8 }}>
                  <span className="row" style={{ gap: 3 }}><Icon name="bag" size={11} /> {s.listings_count || 0}</span>
                  <span className="row" style={{ gap: 3 }}><Icon name="users" size={11} /> {s.followers}</span>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {pagination && pagination.total > 24 && (
        <div className="pagination">
          <button type="button" className="page-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
          <span className="chip">{page} / {Math.ceil(pagination.total / 24)}</span>
          <button type="button" className="page-btn" disabled={page >= Math.ceil(pagination.total / 24)} onClick={() => setPage(page + 1)}>›</button>
        </div>
      )}
    </div>
  );
}
