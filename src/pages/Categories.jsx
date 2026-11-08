import { Link } from 'react-router-dom';
import Icon, { CATEGORY_ICONS } from '../components/Icon.jsx';
import { useApp } from '../state/AppContext.jsx';
import { formatNumber, pickName } from '../lib/format.js';

export default function Categories() {
  const { t, lang, categories } = useApp();

  return (
    <div className="container" style={{ paddingTop: 26, paddingBottom: 40 }}>
      <nav className="tiny muted row" style={{ gap: 6, marginBottom: 12 }} aria-label="breadcrumb">
        <Link to="/" className="link">{t('nav.home')}</Link>
        <Icon name="chevronLeft" size={12} className="rtl-flip" />
        <span>{t('nav.categories')}</span>
      </nav>

      <h1 style={{ fontSize: 'clamp(1.3rem, 3.4vw, 1.9rem)', marginBottom: 6 }}>{t('nav.categories')}</h1>
      <p className="muted small" style={{ marginBottom: 22 }}>
        {lang === 'ar'
          ? 'كل ما تحتاجه للبيع والشراء، مصنف بسهولة.'
          : lang === 'fr'
            ? 'Tout ce dont vous avez besoin, bien classé.'
            : 'Everything you need, neatly organized.'}
      </p>

      <div className="stack" style={{ gap: 14 }}>
        {categories.map((cat) => (
          <div key={cat.id} className="card card-pad">
            <div className="row-between" style={{ marginBottom: 12 }}>
              <Link to={`/category/${cat.slug}`} className="row" style={{ gap: 10 }}>
                <span className="cat-tile-icon" style={cat.color ? { color: cat.color, background: `${cat.color}12` } : undefined}>
                  <Icon name={CATEGORY_ICONS[cat.icon] || 'box'} size={21} />
                </span>
                <div>
                  <b style={{ fontSize: '1rem' }}>{pickName(cat.name, lang)}</b>
                  <div className="tiny muted">
                    {formatNumber(cat.listings_count || 0, lang)} {t('nav.listings')}
                  </div>
                </div>
              </Link>
              <Link to={`/category/${cat.slug}`} className="btn btn-ghost btn-sm">
                {t('common.viewAll')} <Icon name="chevronLeft" size={14} className="rtl-flip" />
              </Link>
            </div>
            {cat.children?.length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {cat.children.map((child) => (
                  <Link key={child.id} to={`/category/${child.slug}`} className="chip" style={{ cursor: 'pointer' }}>
                    {pickName(child.name, lang)}
                    {child.listings_count > 0 && <span className="tiny muted">({child.listings_count})</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
