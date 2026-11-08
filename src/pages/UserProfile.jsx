import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ListingCard from '../components/ListingCard.jsx';
import { Avatar, EmptyState, SkeletonGrid, Stars } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { formatDate, pickName, timeAgo } from '../lib/format.js';

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang, user, toast } = useApp();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('listings');
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setData(null);
    setNotFound(false);
    api
      .get(`/auth/users/${id}`)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    if (!user) return;
    api.get('/conversations/blocks/list').then((r) => setBlocked(r.items.some((b) => b.id === Number(id)))).catch(() => {});
  }, [user, id]);

  if (notFound) {
    return (
      <div className="container" style={{ padding: '60px 0' }}>
        <EmptyState icon="user" title={t('errors.not_found')} action={<Link to="/" className="btn mt-2">{t('common.goHome')}</Link>} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div className="skeleton" style={{ height: 150, borderRadius: 'var(--radius-lg)' }} />
        <div className="mt-3"><SkeletonGrid count={4} /></div>
      </div>
    );
  }

  const u = data.user;
  const isMe = user?.id === u.id;

  const toggleBlock = async () => {
    try {
      if (blocked) await api.del(`/conversations/block/${u.id}`);
      else await api.post(`/conversations/block/${u.id}`, {});
      setBlocked(!blocked);
      toast(t('account.saved'), 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 44 }}>
      <div className="card card-pad" style={{ display: 'grid', gap: 14 }}>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <Avatar src={u.avatar} name={u.name} size="xl" />
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 'clamp(1.15rem,3vw,1.5rem)' }}>{u.name}</h1>
              {u.verified_seller && (
                <span className="chip chip-brand tiny"><Icon name="verified" size={12} /> {t('account.verifiedSeller')}</span>
              )}
              {data.store && <span className="chip chip-info tiny"><Icon name="store" size={12} /> {t('store.myStore')}</span>}
            </div>
            <div className="row" style={{ gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
              <Stars value={u.rating_avg} count={u.rating_count} size={15} />
              <span className="tiny muted"><Icon name="mapPin" size={12} /> {pickName(u.city?.name, lang) || '—'}</span>
              <span className="tiny muted"><Icon name="clock" size={12} /> {t('listing.memberSince')} {formatDate(u.created_at, lang)}</span>
              {u.last_seen_at && <span className="tiny muted">{timeAgo(u.last_seen_at, t)}</span>}
            </div>
            {u.bio && <p className="small muted" style={{ marginTop: 8 }}>{u.bio}</p>}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {isMe ? (
              <>
                <Link to="/account" className="btn btn-outline btn-sm"><Icon name="settings" size={15} /> {t('nav.account')}</Link>
                <Link to="/my-listings" className="btn btn-sm">{t('nav.myListings')}</Link>
              </>
            ) : user ? (
              <>
                <button type="button" className="btn btn-outline btn-sm" onClick={toggleBlock}>
                  <Icon name={blocked ? 'check' : 'ban'} size={15} /> {blocked ? t('messages.unblock') : t('messages.block')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={async () => {
                    try {
                      await api.post('/reports', { target_type: 'user', target_id: u.id, reason: 'scam' });
                      toast(t('report.sent'), 'success');
                    } catch (err) {
                      toast(err.message, 'error');
                    }
                  }}
                >
                  <Icon name="flag" size={15} /> {t('listing.report')}
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-sm">{t('nav.login')}</Link>
            )}
            {data.store && (
              <Link to={`/stores/${data.store.slug}`} className="btn btn-sm btn-soft">
                <Icon name="store" size={15} /> {t('listing.viewStore')}
              </Link>
            )}
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {[
            { label: t('myListings.active'), value: data.stats.active_listings },
            { label: t('myListings.sold'), value: data.stats.sold },
            { label: t('review.count', { n: u.rating_count }), value: u.rating_count },
            { label: t('store.followers'), value: data.stats.followers },
          ].map((s) => (
            <div key={s.label} className="chip" style={{ padding: '7px 12px' }}>
              <b>{s.value}</b> <span className="muted tiny">{s.label}</span>
            </div>
          ))}
          {data.phone && (
            <a href={`tel:${data.phone}`} className="chip chip-brand" dir="ltr">
              <Icon name="phone" size={13} /> {data.phone}
            </a>
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 6, margin: '16px 0' }}>
        <button type="button" className={`chip ${tab === 'listings' ? 'chip-brand' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab('listings')}>
          <Icon name="list" size={13} /> {t('nav.listings')} ({data.listings.length})
        </button>
        <button type="button" className={`chip ${tab === 'reviews' ? 'chip-brand' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTab('reviews')}>
          <Icon name="star" size={13} /> {t('store.reviews')} ({data.reviews.length})
        </button>
      </div>

      {tab === 'listings' && (
        data.listings.length ? (
          <div className="listing-grid">
            {data.listings.map((l) => (
              <ListingCard
                key={l.public_id}
                listing={{
                  ...l,
                  id: l.id,
                  public_id: l.public_id,
                  category: { name: { ar: l.cat_ar, fr: l.cat_fr, en: l.cat_en }, slug: l.cat_slug },
                  city: { name: { ar: l.city_ar, fr: l.city_fr, en: l.city_en }, slug: l.city_slug },
                }}
              />
            ))}
          </div>
        ) : (
          <div className="card"><EmptyState icon="box" title={t('search.noResults')} /></div>
        )
      )}

      {tab === 'reviews' && (
        <div className="stack" style={{ gap: 10 }}>
          {data.reviews.length === 0 && (
            <div className="card"><EmptyState icon="star" title={t('store.noReviews')} /></div>
          )}
          {data.reviews.map((r, i) => (
            <div key={i} className="card card-pad">
              <div className="row-between" style={{ marginBottom: 6 }}>
                <div className="row" style={{ gap: 8 }}>
                  <Avatar src={r.reviewer_avatar} name={r.reviewer_name} size="sm" />
                  <b style={{ fontSize: '0.86rem' }}>{r.reviewer_name}</b>
                  {r.verified && <span className="chip chip-success tiny"><Icon name="check" size={11} /> {t('account.verified')}</span>}
                </div>
                <Stars value={r.rating} size={13} />
              </div>
              {r.comment && <p className="small">{r.comment}</p>}
              <span className="tiny muted">{timeAgo(r.created_at, t)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
