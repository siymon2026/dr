import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ListingCard from '../components/ListingCard.jsx';
import { EmptyState, SkeletonGrid } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';

export default function Favorites() {
  const { t, user, toast, errorMessage } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!user) navigate('/login?next=/favorites', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    api
      .get('/favorites')
      .then((res) => setItems(res.items))
      .catch((err) => {
        toast(errorMessage(err), 'error');
        setItems([]);
      });
  }, [user, toast, errorMessage]);

  const onToggle = (id, favorite) => {
    if (!favorite) setItems((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 44 }}>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 'clamp(1.2rem,3vw,1.55rem)' }} className="row">
          <Icon name="heart" size={22} style={{ color: 'var(--accent-500)' }} /> {t('favorites.title')}
        </h1>
        {items && <span className="chip chip-brand">{items.length}</span>}
      </div>

      {!items && <SkeletonGrid count={4} />}

      {items && items.length === 0 && (
        <div className="card">
          <EmptyState
            icon="heart"
            title={t('favorites.empty')}
            hint={t('favorites.hint')}
            action={<Link to="/listings" className="btn mt-2">{t('nav.listings')}</Link>}
          />
        </div>
      )}

      {items && items.length > 0 && (
        <div className="listing-grid">
          {items.map((l) => (
            <ListingCard key={l.id} listing={l} saved onToggleSave={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
