import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { ImageWithFallback } from './ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { formatPrice, pickName, timeAgo } from '../lib/format.js';

export default function ListingCard({ listing, saved = false, onToggleSave, compact = false }) {
  const { t, lang, user, toast, errorMessage } = useApp();
  const [isSaved, setIsSaved] = useState(saved);
  const [busy, setBusy] = useState(false);

  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast(t('common.unauthorized'), 'error');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post(`/favorites/${listing.id}`);
      setIsSaved(res.favorite);
      onToggleSave?.(listing.id, res.favorite);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const cityName = pickName(listing.city?.name, lang);
  const href = `/listing/${listing.public_id || listing.id}`;

  return (
    <Link to={href} className="lcard" aria-label={listing.title}>
      <div className="lcard-media">
        <ImageWithFallback src={listing.image} alt={listing.title} />
        <div className="lcard-flag">
          {listing.featured && <span className="flag flag-featured">{t('listing.featured')}</span>}
          {listing.status === 'sold' && <span className="flag flag-sold">{t('listing.sold')}</span>}
          {!listing.featured && listing.condition === 'new' && <span className="flag flag-new">{t('listing.condition.new')}</span>}
        </div>
        <button
          type="button"
          className={`lcard-fav ${isSaved ? 'active' : ''}`}
          onClick={toggle}
          aria-label={t('listing.save')}
          aria-pressed={isSaved}
        >
          <Icon name={isSaved ? 'heartFilled' : 'heart'} size={17} />
        </button>
        {listing.images_count > 1 && (
          <span className="img-count">
            <Icon name="image" size={12} /> {listing.images_count}
          </span>
        )}
      </div>
      <div className="lcard-body">
        <h3 className="lcard-title">{listing.title}</h3>
        <span className="lcard-price">
          {listing.price > 0 ? formatPrice(listing.price, listing.currency, lang) : t('store.contact')}
        </span>
        {!compact && (
          <span className="lcard-meta">
            <Icon name="mapPin" size={12} />
            {cityName}
            <span aria-hidden="true">·</span>
            <Icon name="clock" size={12} />
            {timeAgo(listing.created_at || listing.published_at, t)}
          </span>
        )}
        {compact && (
          <span className="lcard-meta">
            <Icon name="eye" size={12} /> {listing.views}
            <span aria-hidden="true">·</span>
            <Icon name="heart" size={12} /> {listing.favorites}
          </span>
        )}
      </div>
    </Link>
  );
}
