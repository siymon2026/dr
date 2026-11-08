import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ListingCard from '../components/ListingCard.jsx';
import { Avatar, EmptyState, SkeletonGrid, Stars } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatNumber, pickName, timeAgo } from '../lib/format.js';
import { applySeo } from '../lib/seo.js';

export default function StoreDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, lang, user, toast, errorMessage } = useApp();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [tab, setTab] = useState('products');

  useEffect(() => {
    setData(null);
    api
      .get(`/stores/${slug}`)
      .then((res) => {
        setData(res);
        setFollowing(res.following);
        setFollowers(res.store.followers);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    if (!data) return undefined;
    return applySeo({
      title: `${data.store.name} | ${t('brand.name')}`,
      description: data.store.description || `${data.store.name} — ${t('nav.stores')}`,
      image: data.store.logo || data.store.cover,
      url: `${window.location.origin}/stores/${data.store.slug}`,
      type: 'website',
    });
  }, [data, t]);

  if (notFound) {
    return (
      <div className="container" style={{ padding: '60px 0' }}>
        <EmptyState icon="store" title={t('errors.not_found')} action={<Link to="/stores" className="btn mt-2">{t('nav.stores')}</Link>} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div className="skeleton" style={{ height: 190, borderRadius: 'var(--radius-lg)' }} />
        <div className="mt-3"><SkeletonGrid count={4} /></div>
      </div>
    );
  }

  const s = data.store;

  const toggleFollow = async () => {
    if (!user) return navigate('/login');
    try {
      const res = await api.post(`/stores/${s.id}/follow`, {});
      setFollowing(res.following);
      setFollowers(res.followers);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 44 }}>
      <nav className="tiny muted row" style={{ gap: 6, marginBottom: 12 }} aria-label="breadcrumb">
        <Link to="/" className="link">{t('nav.home')}</Link>
        <Icon name="chevronLeft" size={12} className="rtl-flip" />
        <Link to="/stores" className="link">{t('nav.stores')}</Link>
        <Icon name="chevronLeft" size={12} className="rtl-flip" />
        <span>{s.name}</span>
      </nav>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ height: 168, background: 'linear-gradient(135deg, var(--brand-600), var(--brand-900))', position: 'relative' }}>
          {s.cover && <img src={s.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />}
          {s.status === 'pending' && (
            <span className="flag flag-new" style={{ position: 'absolute', top: 12, insetInlineStart: 12 }}>{t('store.pending')}</span>
          )}
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          <div className="row" style={{ gap: 14, marginTop: -38, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Avatar src={s.logo} name={s.name} size="xl" style={{ border: '4px solid var(--surface)' }} />
            <div style={{ flex: '1 1 240px', paddingTop: 40 }}>
              <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'clamp(1.15rem,3vw,1.5rem)' }}>{s.name}</h1>
                {s.verified && <span className="chip chip-brand tiny"><Icon name="verified" size={12} /> {t('store.verified')}</span>}
              </div>
              <div className="row tiny muted" style={{ gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                <span className="row" style={{ gap: 4 }}><Icon name="mapPin" size={12} /> {pickName(s.city?.name, lang) || '—'}</span>
                <Stars value={s.rating_avg} count={s.rating_count} size={13} />
                <span className="row" style={{ gap: 4 }}><Icon name="users" size={12} /> {formatNumber(followers, lang)} {t('store.followers')}</span>
                <span className="row" style={{ gap: 4 }}><Icon name="bag" size={12} /> {s.listings_count || 0} {t('store.products')}</span>
                <span className="row" style={{ gap: 4 }}><Icon name="check" size={12} /> {s.sales} {t('store.sales')}</span>
              </div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className={`btn btn-sm ${following ? 'btn-soft' : ''}`} onClick={toggleFollow}>
                <Icon name={following ? 'check' : 'plus'} size={15} /> {following ? t('store.following') : t('store.follow')}
              </button>
              {s.whatsapp && (
                <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, '').replace(/^0/, '212')}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">
                  <Icon name="phone" size={15} /> {t('store.whatsapp')}
                </a>
              )}
              {s.website && (
                <a href={s.website} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">
                  <Icon name="globe" size={15} /> {t('store.website')}
                </a>
              )}
              {user?.id === s.owner?.id && (
                <Link to="/store/manage" className="btn btn-sm btn-outline"><Icon name="settings" size={15} /> {t('store.myStore')}</Link>
              )}
            </div>
          </div>
          {s.description && <p className="small muted" style={{ marginTop: 14, maxWidth: 760 }}>{s.description}</p>}
        </div>
      </div>

      <div className="row" style={{ gap: 6, margin: '16px 0' }}>
        <button type="button" className={`chip ${tab === 'products' ? 'chip-brand' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab('products')}>
          <Icon name="bag" size={13} /> {t('store.products')} ({data.listings.items.length})
        </button>
        <button type="button" className={`chip ${tab === 'reviews' ? 'chip-brand' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab('reviews')}>
          <Icon name="star" size={13} /> {t('store.reviews')} ({data.reviews.length})
        </button>
        <button type="button" className={`chip ${tab === 'about' ? 'chip-brand' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab('about')}>
          <Icon name="info" size={13} /> {t('store.about')}
        </button>
      </div>

      {tab === 'products' && (
        data.listings.items.length ? (
          <div className="listing-grid">
            {data.listings.items.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        ) : (
          <div className="card"><EmptyState icon="bag" title={t('search.noResults')} /></div>
        )
      )}

      {tab === 'reviews' && (
        <div className="stack" style={{ gap: 10 }}>
          {data.reviews.length === 0 && <div className="card"><EmptyState icon="star" title={t('store.noReviews')} /></div>}
          {data.reviews.map((r, i) => (
            <div key={i} className="card card-pad">
              <div className="row-between" style={{ marginBottom: 6 }}>
                <div className="row" style={{ gap: 8 }}>
                  <Avatar src={r.reviewer_avatar} name={r.reviewer_name} size="sm" />
                  <b style={{ fontSize: '0.86rem' }}>{r.reviewer_name}</b>
                </div>
                <Stars value={r.rating} size={13} />
              </div>
              {r.comment && <p className="small">{r.comment}</p>}
              <span className="tiny muted">{timeAgo(r.created_at, t)}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'about' && (
        <div className="card card-pad" style={{ display: 'grid', gap: 14 }}>
          <p className="small">{s.description}</p>
          <div className="spec-grid">
            <div className="spec"><span>{t('filters.city')}</span><b>{pickName(s.city?.name, lang) || '—'}</b></div>
            <div className="spec"><span>{t('store.followers')}</span><b>{formatNumber(followers, lang)}</b></div>
            <div className="spec"><span>{t('store.sales')}</span><b>{s.sales}</b></div>
            <div className="spec"><span>{t('listing.memberSince')}</span><b>{formatDate(s.created_at, lang)}</b></div>
            {s.phone && <div className="spec"><span>{t('auth.phone')}</span><b dir="ltr">{s.phone}</b></div>}
          </div>
        </div>
      )}
    </div>
  );
}
