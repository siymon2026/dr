import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon, { CATEGORY_ICONS } from './Icon.jsx';
import { Avatar } from './ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { LANGS } from '../i18n.js';
import { pickName } from '../lib/format.js';

function BrandLogo({ size = 42 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.5 8.5 12 3.5l8.5 5-8.5 5Z" fill="rgba(255,255,255,.92)" />
        <path d="m3.5 13 8.5 5 8.5-5" stroke="rgba(255,255,255,.62)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="17.5" cy="6" r="2.6" fill="#ff7a45" />
      </svg>
    </span>
  );
}

export default function Header() {
  const { t, lang, setLang, user, logout, unread, cities, cityId, setCity, categories, theme, toggleTheme, activeCity } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const langRef = useRef(null);

  useEffect(() => {
    setMenuOpen(false);
    setLangOpen(false);
    setMobileMenu(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // keep the search box in sync when landing on /listings?q=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname.startsWith('/listings')) setQ(params.get('q') || '');
  }, [location.pathname, location.search]);

  const submitSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (cityId) params.set('city', String(cityId));
    navigate(`/listings${params.toString() ? `?${params}` : ''}`);
  };

  const nav = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/listings', label: t('nav.listings') },
    { to: '/categories', label: t('nav.categories') },
    { to: '/stores', label: t('nav.stores') },
    { to: '/pricing', label: t('nav.pricing') },
    { to: '/listings?featured=1', label: t('nav.featured') },
  ];

  return (
    <header className="app-header">
      <div className="container">
        <div className="header-main">
          <Link to="/" className="brand" aria-label={t('brand.name')}>
            <BrandLogo />
            <span className="brand-text">
              <b>{t('brand.name')}</b>
              <span>{t('brand.tag')}</span>
            </span>
          </Link>

          <form className="header-search" onSubmit={submitSearch} role="search">
            <Icon name="search" size={18} style={{ marginInlineStart: 8, color: 'var(--ink-400)' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('search.placeholder')}
              aria-label={t('search.q')}
            />
            <select
              className="city-select"
              value={cityId || ''}
              onChange={(e) => setCity(e.target.value ? Number(e.target.value) : null)}
              aria-label={t('search.city')}
            >
              <option value="">{t('search.allCities')}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickName(c.name, lang)}
                </option>
              ))}
            </select>
            <button type="submit" className="search-btn" aria-label={t('search.button')}>
              <Icon name="search" size={17} />
            </button>
          </form>

          <div className="header-actions">
            <Link to="/post" className="btn btn-accent desktop-only" style={{ paddingInline: 16 }}>
              <Icon name="plus" size={17} />
              {t('nav.post')}
            </Link>

            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'light' : 'dark'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
            </button>

            <div className="relative" ref={langRef}>
              <button type="button" className="icon-btn" onClick={() => setLangOpen((v) => !v)} aria-label="language" aria-expanded={langOpen}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{lang.toUpperCase()}</span>
              </button>
              {langOpen && (
                <div className="menu-pop" style={{ minWidth: 168 }}>
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        setLang(l.code);
                        setLangOpen(false);
                      }}
                    >
                      <span>{l.flag}</span>
                      <span style={{ flex: 1 }}>{l.label}</span>
                      {lang === l.code && <Icon name="check" size={15} style={{ color: 'var(--brand-600)' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user ? (
              <>
                <NavLink to="/messages" className="icon-btn" aria-label={t('nav.messages')}>
                  <Icon name="message" size={19} />
                  {unread.messages > 0 && <span className="dot-badge">{unread.messages > 9 ? '9+' : unread.messages}</span>}
                </NavLink>
                <NavLink to="/notifications" className="icon-btn" aria-label={t('nav.notifications')}>
                  <Icon name="bell" size={19} />
                  {unread.notifications > 0 && (
                    <span className="dot-badge">{unread.notifications > 9 ? '9+' : unread.notifications}</span>
                  )}
                </NavLink>

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    className="row"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-expanded={menuOpen}
                    aria-label={t('nav.profile')}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
                  >
                    <Avatar src={user.avatar} name={user.name} size="sm" />
                    <Icon name="chevronDown" size={15} style={{ color: 'var(--ink-400)' }} />
                  </button>
                  {menuOpen && (
                    <div className="menu-pop">
                      <div style={{ padding: '8px 11px 10px' }}>
                        <div className="row" style={{ gap: 9 }}>
                          <Avatar src={user.avatar} name={user.name} />
                          <div style={{ minWidth: 0 }}>
                            <div className="strong truncate" style={{ fontSize: '0.86rem' }}>{user.name}</div>
                            <div className="tiny muted truncate">{user.email || user.phone}</div>
                          </div>
                        </div>
                      </div>
                      <div className="menu-sep" />
                      <Link to={`/users/${user.id}`} className="menu-item">
                        <Icon name="user" size={16} /> {t('nav.profile')}
                      </Link>
                      <Link to="/my-listings" className="menu-item">
                        <Icon name="list" size={16} /> {t('nav.myListings')}
                      </Link>
                      <Link to="/favorites" className="menu-item">
                        <Icon name="heart" size={16} /> {t('nav.favorites')}
                      </Link>
                      <Link to="/messages" className="menu-item">
                        <Icon name="message" size={16} /> {t('nav.messages')}
                      </Link>
                      <Link to="/store/manage" className="menu-item">
                        <Icon name="store" size={16} /> {t('nav.store')}
                      </Link>
                      <Link to="/account" className="menu-item">
                        <Icon name="settings" size={16} /> {t('nav.account')}
                      </Link>
                      {user.permissions?.length > 0 && (
                        <>
                          <div className="menu-sep" />
                          <Link to="/admin" className="menu-item">
                            <Icon name="shield" size={16} /> {t('nav.admin')}
                          </Link>
                        </>
                      )}
                      <div className="menu-sep" />
                      <button
                        type="button"
                        className="menu-item danger"
                        onClick={async () => {
                          await logout();
                          navigate('/');
                        }}
                      >
                        <Icon name="logout" size={16} /> {t('nav.logout')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost desktop-only">
                  {t('nav.login')}
                </Link>
                <Link to="/register" className="btn btn-outline desktop-only">
                  {t('nav.register')}
                </Link>
                <Link to="/login" className="icon-btn mobile-only" aria-label={t('nav.login')}>
                  <Icon name="user" size={20} />
                </Link>
              </>
            )}

            <button type="button" className="icon-btn mobile-only" onClick={() => setMobileMenu((v) => !v)} aria-label="menu" aria-expanded={mobileMenu}>
              <Icon name={mobileMenu ? 'close' : 'hamburger'} size={20} />
            </button>
          </div>
        </div>

        <nav className="cat-bar desktop-only" aria-label="main">
          <div className="cat-bar-inner">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `cat-link ${isActive ? 'active' : ''}`}>
                {item.label}
              </NavLink>
            ))}
            <span style={{ flex: 1 }} />
            {categories.slice(0, 3).map((c) => (
              <Link key={c.id} to={`/category/${c.slug}`} className="cat-link">
                <Icon name={CATEGORY_ICONS[c.icon] || 'box'} size={14} />
                {pickName(c.name, lang)}
              </Link>
            ))}
          </div>
        </nav>

        {mobileMenu && (
          <div className="mobile-only" style={{ paddingBottom: 12, gap: 4 }}>
            {[...nav, ...(user ? [{ to: '/post', label: t('nav.post') }] : [{ to: '/login', label: t('nav.login') }, { to: '/register', label: t('nav.register') }])].map((item) => (
              <Link key={item.to} to={item.to} className="cat-link" style={{ borderRadius: 10 }}>
                {item.label}
              </Link>
            ))}
            {activeCity && (
              <span className="chip chip-brand" style={{ marginTop: 6, width: 'fit-content' }}>
                <Icon name="mapPin" size={13} /> {pickName(activeCity.name, lang)}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
