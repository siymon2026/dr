import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon, { CATEGORY_ICONS } from '../components/Icon.jsx';
import ListingCard from '../components/ListingCard.jsx';
import { SkeletonGrid, EmptyState, Avatar, Stars } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api, qs } from '../lib/api.js';
import { formatNumber, pickName } from '../lib/format.js';

function Section({ title, link, icon, children, subtitle }) {
  return (
    <section className="section-sm">
      <div className="section-head">
        <div>
          <h2 className="section-title">
            {icon ? <span className="section-head-icon"><Icon name={icon} size={19} /></span> : <span className="dot" />}
            {title}
          </h2>
          {subtitle && <p className="small muted" style={{ marginTop: 4 }}>{subtitle}</p>}
        </div>
        {link && (
          <Link to={link.to} className="section-link">
            {link.label}
            <Icon name="chevronLeft" size={15} className="rtl-flip" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function NearbyBlock() {
  const { t, lang, requestGeolocation, geoCoords, toast } = useApp();
  const [state, setState] = useState('idle');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!geoCoords) return;
    setState('loading');
    api
      .get(`/listings/nearby${qs({ lat: geoCoords.lat, lng: geoCoords.lng, radius: 60, limit: 8 })}`)
      .then((res) => {
        setItems(res.items);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [geoCoords]);

  const locate = async () => {
    setState('loading');
    try {
      await requestGeolocation();
    } catch {
      setState('denied');
      toast(t('common.offline'), 'error');
    }
  };

  if (state === 'idle' || state === 'denied') {
    return (
      <div className="card card-pad row-between" style={{ flexWrap: 'wrap', gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="stat-icon" style={{ width: 42, height: 42 }}>
            <Icon name="location" size={20} />
          </span>
          <div>
            <b>{t('home.nearby')}</b>
            <p className="small muted">
              {lang === 'ar'
                ? 'اسمح بالوصول لموقعك لعرض الإعلانات القريبة منك.'
                : lang === 'fr'
                  ? 'Autorisez la géolocalisation pour voir les annonces près de vous.'
                  : 'Allow location access to see listings near you.'}
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-soft" onClick={locate}>
          <Icon name="mapPin" size={16} /> {t('search.nearby')}
        </button>
      </div>
    );
  }
  if (state === 'loading') return <SkeletonGrid count={4} />;
  if (state === 'error' || !items.length) return null;

  return (
    <div className="listing-grid">
      {items.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}

export default function Home() {
  const { t, lang, categories, cities, user, cityId } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [term, setTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/listings/home')
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const topCategories = useMemo(() => categories.slice(0, 12), [categories]);

  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (term.trim()) params.set('q', term.trim());
    if (cityId) params.set('city', String(cityId));
    navigate(`/listings${params.toString() ? `?${params}` : ''}`);
  };

  const stats = data?.stats || {};

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="stack" style={{ gap: 18 }}>
            <span className="chip" style={{ background: 'rgba(255,255,255,.14)', borderColor: 'rgba(255,255,255,.2)', color: '#fff', width: 'fit-content' }}>
              <Icon name="bolt" size={13} />
              {lang === 'ar' ? 'أسرع منصة بيع وشراء في المغرب' : lang === 'fr' ? 'La marketplace marocaine la plus rapide' : 'Morocco’s fastest marketplace'}
            </span>
            <h1 dangerouslySetInnerHTML={{ __html: t('hero.title') }} />
            <p className="lead">{t('hero.lead')}</p>

            <form className="hero-search" onSubmit={submit} role="search">
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={t('search.placeholder')}
                aria-label={t('search.q')}
              />
              <select
                value={cityId || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) navigate(`/listings?city=${v}`);
                }}
                aria-label={t('search.city')}
              >
                <option value="">{t('search.allCities')}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pickName(c.name, lang)}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn">
                <Icon name="search" size={17} /> {t('search.button')}
              </button>
            </form>

            <div className="hero-tags">
              <span className="tiny" style={{ color: 'rgba(255,255,255,.6)' }}>
                {t('search.popular')}:
              </span>
              {[
                { q: lang === 'ar' ? 'آيفون' : 'iPhone', icon: 'phone' },
                { q: lang === 'ar' ? 'سيارة' : 'voiture', icon: 'car' },
                { q: lang === 'ar' ? 'شقة' : 'appartement', icon: 'home' },
                { q: lang === 'ar' ? 'لابتوب' : 'laptop', icon: 'laptop' },
              ].map((tag) => (
                <Link key={tag.q} to={`/listings?q=${encodeURIComponent(tag.q)}`} className="chip">
                  <Icon name={tag.icon} size={12} /> {tag.q}
                </Link>
              ))}
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <b>{formatNumber(stats.listings || 0, lang)}</b>
                <span>{t('hero.stat.listings')}</span>
              </div>
              <div className="hero-stat">
                <b>{formatNumber(stats.users || 0, lang)}</b>
                <span>{t('hero.stat.users')}</span>
              </div>
              <div className="hero-stat">
                <b>{formatNumber(stats.stores || 0, lang)}</b>
                <span>{t('hero.stat.stores')}</span>
              </div>
              <div className="hero-stat">
                <b>{formatNumber(stats.cities || 0, lang)}</b>
                <span>{t('hero.stat.cities')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        {/* ---------------- categories ---------------- */}
        <Section title={t('home.categories')} link={{ to: '/categories', label: t('common.viewAll') }}>
          <div className="cat-tiles">
            {topCategories.map((c) => (
              <Link key={c.id} to={`/category/${c.slug}`} className="cat-tile">
                <span className="cat-tile-icon" style={c.color ? { color: c.color, background: `${c.color}12` } : undefined}>
                  <Icon name={CATEGORY_ICONS[c.icon] || 'box'} size={22} />
                </span>
                <span>{pickName(c.name, lang)}</span>
                <small>{formatNumber(c.listings_count || 0, lang)}</small>
              </Link>
            ))}
            <Link to="/categories" className="cat-tile">
              <span className="cat-tile-icon">
                <Icon name="grid" size={22} />
              </span>
              <span>{t('nav.categories')}</span>
              <small>{categories.length}</small>
            </Link>
          </div>
        </Section>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            <Icon name="alert" size={17} />
            {t('common.error')}
          </div>
        )}

        {/* ---------------- featured ---------------- */}
        {!data ? (
          <div className="section-sm">
            <SkeletonGrid count={4} />
          </div>
        ) : (
          <>
            {data.featured.length > 0 && (
              <Section
                title={t('home.featured')}
                icon="spark"
                link={{ to: '/listings?featured=1', label: t('common.viewAll') }}
                subtitle={lang === 'ar' ? 'إعلانات مميزة من بائعين موثوقين' : lang === 'fr' ? 'Annonces mises en avant par des vendeurs de confiance' : 'Highlighted listings from trusted sellers'}
              >
                <div className="listing-grid">
                  {data.featured.slice(0, 8).map((l) => (
                    <ListingCard key={l.id} listing={l} />
                  ))}
                </div>
              </Section>
            )}

            <Section title={t('home.latest')} link={{ to: '/listings', label: t('common.viewAll') }}>
              <div className="listing-grid">
                {data.latest.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
              {!data.latest.length && (
                <div className="card">
                  <EmptyState
                    icon="box"
                    title={t('search.noResults')}
                    hint={lang === 'ar' ? 'كن أول من ينشر إعلاناً!' : lang === 'fr' ? 'Soyez le premier à publier !' : 'Be the first to post!'}
                    action={
                      <Link to="/post" className="btn mt-2">
                        <Icon name="plus" size={16} /> {t('nav.post')}
                      </Link>
                    }
                  />
                </div>
              )}
            </Section>

            {data.deals.length > 0 && (
              <Section
                title={t('home.deals')}
                icon="tag"
                subtitle={lang === 'ar' ? 'منتجات بأقل من 500 درهم' : lang === 'fr' ? 'Produits à moins de 500 MAD' : 'Items under 500 MAD'}
              >
                <div className="listing-grid">
                  {data.deals.slice(0, 4).map((l) => (
                    <ListingCard key={l.id} listing={l} compact />
                  ))}
                </div>
              </Section>
            )}

            <Section title={t('home.popular')} link={{ to: '/listings?sort=views', label: t('common.viewAll') }}>
              <div className="listing-grid">
                {data.popular.slice(0, 8).map((l) => (
                  <ListingCard key={l.id} listing={l} compact />
                ))}
              </div>
            </Section>

            {data.stores.length > 0 && (
              <Section title={t('home.stores')} icon="store" link={{ to: '/stores', label: t('common.viewAll') }}>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                  {data.stores.map((s) => (
                    <Link key={s.id} to={`/stores/${s.slug}`} className="card card-pad" style={{ display: 'grid', gap: 10 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar src={s.logo} name={s.name} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="row" style={{ gap: 5 }}>
                            <b className="truncate" style={{ fontSize: '0.94rem' }}>{s.name}</b>
                            {s.verified && (
                              <span className="badge-verified" title={t('store.verified')}>
                                <Icon name="verified" size={14} />
                              </span>
                            )}
                          </div>
                          <div className="tiny muted row" style={{ gap: 4 }}>
                            <Icon name="mapPin" size={11} />
                            {pickName({ ar: s.city_ar, fr: s.city_fr, en: s.city_en }, lang) || '—'}
                          </div>
                        </div>
                      </div>
                      <div className="row-between tiny muted">
                        <Stars value={s.rating_avg} count={s.rating_count} size={13} />
                        <span className="row" style={{ gap: 4 }}>
                          <Icon name="bag" size={12} /> {s.listings_count} · <Icon name="users" size={12} /> {s.followers_count}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}

        {/* ---------------- nearby ---------------- */}
        <section className="section-sm">
          <Section title={t('home.nearby')} icon="location">
            <NearbyBlock />
          </Section>
        </section>

        {/* ---------------- how to ---------------- */}
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">
              <span className="dot" />
              {t('home.howTo')}
            </h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            <div className="card card-pad" style={{ display: 'grid', gap: 16 }}>
              <div className="row-between">
                <h3 className="row" style={{ gap: 8, fontSize: '1.05rem' }}>
                  <span className="stat-icon" style={{ background: '#fff4ed', color: 'var(--accent-600)' }}>
                    <Icon name="tag" size={17} />
                  </span>
                  {t('home.howTo.sell')}
                </h3>
                <Link to="/post" className="btn btn-sm btn-accent">
                  {t('nav.post')}
                </Link>
              </div>
              <div className="stack" style={{ gap: 14 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 11 }}>
                    <span className="step-num" style={{ width: 28, height: 28, fontSize: '0.78rem' }}>{i}</span>
                    <div>
                      <b style={{ fontSize: '0.9rem' }}>{t(`home.step${i}.sell`)}</b>
                      <p className="small muted">{t(`home.step${i}.sell.d`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card card-pad" style={{ display: 'grid', gap: 16 }}>
              <div className="row-between">
                <h3 className="row" style={{ gap: 8, fontSize: '1.05rem' }}>
                  <span className="stat-icon">
                    <Icon name="bag" size={17} />
                  </span>
                  {t('home.howTo.buy')}
                </h3>
                <Link to="/listings" className="btn btn-sm btn-outline">
                  {t('nav.listings')}
                </Link>
              </div>
              <div className="stack" style={{ gap: 14 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 11 }}>
                    <span className="step-num" style={{ width: 28, height: 28, fontSize: '0.78rem' }}>{i}</span>
                    <div>
                      <b style={{ fontSize: '0.9rem' }}>{t(`home.step${i}.buy`)}</b>
                      <p className="small muted">{t(`home.step${i}.buy.d`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- trust ---------------- */}
        <section className="section-sm" style={{ paddingBottom: 40 }}>
          <div className="section-head">
            <h2 className="section-title">
              <span className="dot" />
              {t('home.trust')}
            </h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            {[
              { icon: 'shield', k: 1 },
              { icon: 'verified', k: 2 },
              { icon: 'star', k: 3 },
              { icon: 'lock', k: 4 },
            ].map((item) => (
              <div key={item.k} className="card card-pad" style={{ display: 'grid', gap: 7 }}>
                <span className="stat-icon" style={{ width: 38, height: 38 }}>
                  <Icon name={item.icon} size={19} />
                </span>
                <b style={{ fontSize: '0.94rem' }}>{t(`home.trust${item.k}`)}</b>
                <p className="small muted">{t(`home.trust${item.k}.d`)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
