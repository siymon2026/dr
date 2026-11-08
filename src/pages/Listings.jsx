import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ListingCard from '../components/ListingCard.jsx';
import { EmptyState, Pagination, SkeletonGrid } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api, qs } from '../lib/api.js';
import { formatNumber, pickName } from '../lib/format.js';

const CONDITIONS = ['new', 'used_excellent', 'used_good', 'needs_repair'];
const SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'views'];

export default function Listings({ featured = false }) {
  const { t, lang, categories, cities, cityId, setCity, rememberSearch } = useApp();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const query = useMemo(() => {
    const base = Object.fromEntries(params.entries());
    if (featured) base.featured = base.featured || '1';
    return base;
  }, [params, featured]);

  const [draft, setDraft] = useState({
    q: query.q || '',
    min_price: query.min_price || '',
    max_price: query.max_price || '',
    city: query.city || (cityId ? String(cityId) : ''),
    category: query.category || '',
    condition: query.condition || '',
    featured: query.featured || '',
    with_photos: query.with_photos || '',
  });

  const sort = SORTS.includes(query.sort) ? query.sort : 'relevance';

  const update = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === '' || value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      }
      if (resetPage) next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  useEffect(() => {
    setDraft({
      q: query.q || '',
      min_price: query.min_price || '',
      max_price: query.max_price || '',
      city: query.city || '',
      category: query.category || '',
      condition: query.condition || '',
      featured: query.featured || '',
      with_photos: query.with_photos || '',
    });
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const payload = { ...query, limit: query.limit || 24 };
    if (!payload.sort) payload.sort = 'relevance';
    api
      .get(`/listings${qs(payload)}`, { signal: controller.signal })
      .then((res) => {
        setData(res);
        if (query.q) rememberSearch(query.q);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, rememberSearch]);

  const selectedCategory = categories
    .flatMap((c) => [c, ...(c.children || [])])
    .find((c) => String(c.id) === String(query.category));

  const applyFilters = () => {
    update({
      q: draft.q.trim(),
      min_price: draft.min_price,
      max_price: draft.max_price,
      city: draft.city,
      category: draft.category,
      condition: draft.condition,
      featured: draft.featured,
      with_photos: draft.with_photos,
    });
    if (draft.city) setCity(Number(draft.city));
    setShowFilters(false);
  };

  const reset = () => {
    const next = new URLSearchParams();
    if (featured) next.set('featured', '1');
    setParams(next, { replace: true });
  };

  const activeCount = ['q', 'min_price', 'max_price', 'city', 'category', 'condition', 'featured', 'with_photos'].filter(
    (k) => query[k],
  ).length;

  const FilterPanel = (
    <aside className="card filters" aria-label={t('filters.title')}>
      <div className="row-between">
        <b className="row" style={{ gap: 6, fontSize: '0.9rem' }}>
          <Icon name="sliders" size={16} /> {t('filters.title')}
          {activeCount > 0 && <span className="badge-count">{activeCount}</span>}
        </b>
        {activeCount > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
            {t('filters.reset')}
          </button>
        )}
      </div>

      <div className="filter-group">
        <span className="filter-title">{t('filters.category')}</span>
        <select
          className="select"
          value={draft.category}
          onChange={(e) => {
            setDraft({ ...draft, category: e.target.value });
            update({ category: e.target.value });
          }}
        >
          <option value="">{t('filters.allCategories')}</option>
          {categories.map((c) => (
            <optgroup key={c.id} label={pickName(c.name, lang)}>
              <option value={c.id}>{pickName(c.name, lang)}</option>
              {(c.children || []).map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {pickName(ch.name, lang)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <span className="filter-title">{t('filters.price')}</span>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder={t('filters.min')}
            value={draft.min_price}
            onChange={(e) => setDraft({ ...draft, min_price: e.target.value })}
            aria-label={t('filters.min')}
          />
          <input
            className="input"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder={t('filters.max')}
            value={draft.max_price}
            onChange={(e) => setDraft({ ...draft, max_price: e.target.value })}
            aria-label={t('filters.max')}
          />
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-title">{t('filters.city')}</span>
        <select
          className="select"
          value={draft.city}
          onChange={(e) => {
            setDraft({ ...draft, city: e.target.value });
            update({ city: e.target.value });
          }}
        >
          <option value="">{t('search.allCities')}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {pickName(c.name, lang)} ({c.listings_count})
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <span className="filter-title">{t('filters.condition')}</span>
        <div className="stack" style={{ gap: 7 }}>
          {CONDITIONS.map((c) => {
            const selected = String(query.condition || '').split(',').includes(c);
            return (
              <label key={c} className="checkbox">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const current = String(query.condition || '').split(',').filter(Boolean);
                    const next = e.target.checked ? [...current, c] : current.filter((x) => x !== c);
                    update({ condition: next.join(',') });
                  }}
                />
                <span>{t(`listing.condition.${c}`)}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="filter-group">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={!!query.featured}
            onChange={(e) => update({ featured: e.target.checked ? '1' : '' })}
          />
          <span>{t('filters.featuredOnly')}</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={!!query.with_photos}
            onChange={(e) => update({ with_photos: e.target.checked ? '1' : '' })}
          />
          <span>{t('filters.withPhotos')}</span>
        </label>
      </div>

      <button type="button" className="btn btn-block" onClick={applyFilters}>
        {t('filters.apply')}
      </button>
    </aside>
  );

  const chips = [];
  if (query.q) chips.push({ key: 'q', label: `"${query.q}"` });
  if (selectedCategory) chips.push({ key: 'category', label: pickName(selectedCategory.name, lang) });
  if (query.city) {
    const city = cities.find((c) => String(c.id) === String(query.city));
    if (city) chips.push({ key: 'city', label: pickName(city.name, lang) });
  }
  if (query.min_price) chips.push({ key: 'min_price', label: `≥ ${formatNumber(query.min_price, lang)} MAD` });
  if (query.max_price) chips.push({ key: 'max_price', label: `≤ ${formatNumber(query.max_price, lang)} MAD` });
  if (query.condition) {
    String(query.condition)
      .split(',')
      .filter(Boolean)
      .forEach((c) => chips.push({ key: `cond-${c}`, label: t(`listing.condition.${c}`), clear: { condition: '' } }));
  }
  if (query.featured) chips.push({ key: 'featured', label: t('filters.featuredOnly') });
  if (query.with_photos) chips.push({ key: 'with_photos', label: t('filters.withPhotos') });

  return (
    <div className="container" style={{ paddingTop: 22, paddingBottom: 40 }}>
      <nav className="tiny muted row" style={{ gap: 6, marginBottom: 12 }} aria-label="breadcrumb">
        <Link to="/" className="link">{t('nav.home')}</Link>
        <Icon name="chevronLeft" size={12} className="rtl-flip" />
        <span>{t('nav.listings')}</span>
      </nav>

      <div className="results-bar">
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem,3vw,1.6rem)' }}>
            {featured ? t('nav.featured') : selectedCategory ? pickName(selectedCategory.name, lang) : t('search.results')}
          </h1>
          <p className="small muted">
            {data ? t('search.found', { n: formatNumber(data.pagination.total, lang) }) : t('common.loading')}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm mobile-only" onClick={() => setShowFilters(true)}>
            <Icon name="filter" size={15} /> {t('filters.show')}
            {activeCount > 0 && <span className="badge-count">{activeCount}</span>}
          </button>
          <select
            className="sort-select"
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            aria-label={t('filters.sort')}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`filters.sort.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="active-filters">
          {chips.map((chip) => (
            <span key={chip.key} className="chip chip-brand">
              {chip.label}
              <button
                type="button"
                onClick={() => update(chip.clear || { [chip.key]: '' })}
                aria-label="remove filter"
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'grid', padding: 0, color: 'inherit' }}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="layout-split">
        <div className="desktop-only">{FilterPanel}</div>

        <div>
          {loading && <SkeletonGrid count={9} />}
          {error && (
            <div className="alert alert-error">
              <Icon name="alert" size={17} /> {t('common.error')}
            </div>
          )}
          {!loading && data && data.items.length === 0 && (
            <div className="card">
              <EmptyState
                icon="search"
                title={t('search.noResults')}
                hint={t('search.noResultsHint')}
                action={
                  <button type="button" className="btn btn-outline mt-2" onClick={reset}>
                    {t('filters.reset')}
                  </button>
                }
              />
            </div>
          )}
          {!loading && data && data.items.length > 0 && (
            <>
              <div className="listing-grid">
                {data.items.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
              <Pagination
                page={data.pagination.page}
                pages={data.pagination.pages}
                onChange={(p) => update({ page: p }, { resetPage: false })}
              />
            </>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowFilters(false)}>
          <div className="modal" style={{ width: 'min(420px, 100%)', maxHeight: '86vh' }}>
            <div className="modal-head">
              <h3>{t('filters.title')}</h3>
              <button type="button" className="icon-btn" onClick={() => setShowFilters(false)} aria-label="close">
                <Icon name="close" size={18} />
              </button>
            </div>
            <div style={{ padding: 14 }}>{FilterPanel}</div>
          </div>
        </div>
      )}
    </div>
  );
}
