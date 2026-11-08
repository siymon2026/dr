import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon, { CATEGORY_ICONS } from '../components/Icon.jsx';
import ListingCard from '../components/ListingCard.jsx';
import { EmptyState, Pagination, SkeletonGrid } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api, qs } from '../lib/api.js';
import { formatNumber, pickName } from '../lib/format.js';
import { applySeo } from '../lib/seo.js';

export default function Category() {
  const { slug } = useParams();
  const { t, lang } = useApp();
  const [cat, setCat] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [listings, setListings] = useState(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('relevance');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api
      .get(`/categories/${slug}`)
      .then((res) => {
        setCat(res);
        setPage(1);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!cat) return undefined;
    const name = pickName(cat.category.name, lang);
    return applySeo({
      title: `${name} — ${formatNumber(listings?.pagination?.total ?? cat.listings_count ?? 0, lang)} ${t('nav.listings')} | ${t('brand.name')}`,
      description:
        cat.category.description
          ? pickName(cat.category.description, lang)
          : `${name} — ${t('brand.slogan')}`,
      url: `${window.location.origin}/category/${cat.category.slug}`,
      type: 'website',
    });
  }, [cat, lang, listings, t]);

  useEffect(() => {
    if (!cat) return;
    setLoading(true);
    api
      .get(`/listings${qs({ category: cat.category.id, page, sort, limit: 24 })}`)
      .then(setListings)
      .catch(() => setListings({ items: [], pagination: { page: 1, pages: 1, total: 0 } }))
      .finally(() => setLoading(false));
  }, [cat, page, sort]);

  if (notFound) {
    return (
      <div className="container" style={{ padding: '60px 0' }}>
        <EmptyState icon="box" title={t('common.notFound')} action={<Link to="/categories" className="btn mt-2">{t('nav.categories')}</Link>} />
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <nav className="tiny muted row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }} aria-label="breadcrumb">
        <Link to="/" className="link">{t('nav.home')}</Link>
        <Icon name="chevronLeft" size={12} className="rtl-flip" />
        <Link to="/categories" className="link">{t('nav.categories')}</Link>
        {cat?.parent && (
          <>
            <Icon name="chevronLeft" size={12} className="rtl-flip" />
            <Link to={`/category/${cat.parent.slug}`} className="link">{pickName(cat.parent.name, lang)}</Link>
          </>
        )}
        <Icon name="chevronLeft" size={12} className="rtl-flip" />
        <span>{cat ? pickName(cat.category.name, lang) : '…'}</span>
      </nav>

      {cat && (
        <div className="card card-pad row-between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <span
              className="cat-tile-icon"
              style={{
                width: 52,
                height: 52,
                ...(cat.category.color ? { color: cat.category.color, background: `${cat.category.color}12` } : {}),
              }}
            >
              <Icon name={CATEGORY_ICONS[cat.category.icon] || 'box'} size={26} />
            </span>
            <div>
              <h1 style={{ fontSize: 'clamp(1.15rem,3vw,1.5rem)' }}>{pickName(cat.category.name, lang)}</h1>
              <p className="small muted">
                {listings ? t('search.found', { n: formatNumber(listings.pagination.total, lang) }) : t('common.loading')}
              </p>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link to={`/listings?category=${cat.category.id}`} className="btn btn-outline btn-sm">
              <Icon name="filter" size={14} /> {t('filters.title')}
            </Link>
            <select className="sort-select" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              {['relevance', 'newest', 'price_asc', 'price_desc', 'views'].map((s) => (
                <option key={s} value={s}>{t(`filters.sort.${s}`)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {cat?.category.children?.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {cat.category.children.map((child) => (
            <Link key={child.id} to={`/category/${child.slug}`} className="chip" style={{ cursor: 'pointer' }}>
              {pickName(child.name, lang)}
            </Link>
          ))}
        </div>
      )}

      {loading && <SkeletonGrid count={8} />}
      {!loading && listings && listings.items.length === 0 && (
        <div className="card">
          <EmptyState
            icon="box"
            title={t('search.noResults')}
            hint={t('search.noResultsHint')}
            action={<Link to="/post" className="btn mt-2"><Icon name="plus" size={16} /> {t('nav.post')}</Link>}
          />
        </div>
      )}
      {!loading && listings && listings.items.length > 0 && (
        <>
          <div className="listing-grid">
            {listings.items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
          <Pagination page={listings.pagination.page} pages={listings.pagination.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
